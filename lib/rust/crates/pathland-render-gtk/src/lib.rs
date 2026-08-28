//! # pathland-render-gtk
//!
//! The Pathland **GTK4 renderer**. It consumes opcode frames (via
//! [`crate::host::RenderTree`]) and maps them **incrementally** onto native GTK4
//! widgets — `GtkBox` for stacks, `GtkLabel` for text, `GtkButton` for buttons.
//!
//! This is the only place in the desktop path that touches GTK/glib/pango APIs.
//! Demos author their UI with the Pathland DSL and drive this renderer; they
//! never call GTK directly.
//!
//! ## Rust host
//!
//! `GtkRenderer::run(app_id, title, ring, on_event)` owns the `gtk::Application`
//! / `ApplicationWindow` / main loop, pumps the shared ring (frames in, events
//! out), and dispatches raw-input [`Event`]s back to the application.
//!
//! ## Java host
//!
//! The `pathland_gtk_*` C ABI (`capi` module) exposes the same renderer to a
//! foreign host (Java via JNA): `pathland_gtk_run(host, on_event)` runs GTK
//! in-process over the `pathland-view-native` host's shared ring.

mod capi;
mod host;
mod layout;

pub use host::{describe, render_tree_from_frame, HostNode, RenderTree};

use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;

use gtk::prelude::*;
use gtk::{
    Align, Box as GtkBox, Button, EventControllerMotion, GestureClick, Label, PropagationPhase,
};
use pathland_core::{component_type, listener, property_id, Event, Frame};
use pathland_core_transport::{DriverTransport, FrameSource, OpcodeBatch, RingTransport, TransportError};

/// The bidirectional transport surface the renderer pumps: frames in
/// (guest → host) and events out (host → guest).
///
/// The renderer **never drains events** — it only writes them as `EVENT`
/// opcodes. The host (application) drains the event ring itself, so raw inputs
/// return to the app through the opcode engine, symmetric with how frames flow
/// to the renderer.
pub trait Pump {
    /// Read the next guest → host frame.
    fn next_frame(&mut self) -> Result<Option<OpcodeBatch<'_>>, TransportError>;
    /// Write a host → guest raw input as an `EVENT` opcode.
    fn send_input(&mut self, event: &Event) -> Result<(), TransportError>;
}

impl Pump for RingTransport {
    fn next_frame(&mut self) -> Result<Option<OpcodeBatch<'_>>, TransportError> {
        FrameSource::next_frame(self)
    }
    fn send_input(&mut self, event: &Event) -> Result<(), TransportError> {
        DriverTransport::send_input(self, event)
    }
}

/// The GTK4 renderer: a retained `id → gtk::Widget` map kept in sync with the
/// opcode stream, applying deltas incrementally.
pub struct GtkRenderer {
    tree: RenderTree,
    widgets: HashMap<u32, gtk::Widget>,
    /// node id → listener bitmask already attached (idempotency guard so delta
    /// frames don't double-attach controllers).
    attached_listeners: HashMap<u32, u32>,
    /// Set once before the first render so buttons can report clicks.
    event_sink: Option<Rc<RefCell<dyn FnMut(Event)>>>,
}

impl Default for GtkRenderer {
    fn default() -> Self {
        Self::new()
    }
}

impl GtkRenderer {
    /// Create an empty renderer. Call [`GtkRenderer::apply_frame`] per frame.
    pub fn new() -> Self {
        Self {
            tree: RenderTree::default(),
            widgets: HashMap::new(),
            attached_listeners: HashMap::new(),
            event_sink: None,
        }
    }

    /// Set the event sink (called when a native widget reports an input).
    pub fn set_event_sink(&mut self, sink: Rc<RefCell<dyn FnMut(Event)>>) {
        self.event_sink = Some(sink);
    }

    /// Apply one frame of opcode deltas and reconcile the GTK widget tree.
    ///
    /// Unchanged widgets are preserved (no full rebuild); only nodes the frame
    /// touched get their native widget created, updated, or removed.
    pub fn apply_frame(&mut self, frame: &Frame<'_>) {
        self.tree.apply_frame(frame);
        self.sync();
    }

    /// The root widget (the native element for the tree root).
    pub fn root_widget(&self) -> Option<gtk::Widget> {
        self.tree
            .root()
            .and_then(|n| self.widgets.get(&n.id).cloned())
    }

    /// Reconcile the GTK widget tree against the current `RenderTree`.
    fn sync(&mut self) {
        // 1. Drop widgets for nodes that no longer exist.
        let live: std::collections::HashSet<u32> = self.tree.nodes.keys().copied().collect();
        let stale: Vec<u32> = self
            .widgets
            .keys()
            .copied()
            .filter(|id| !live.contains(id))
            .collect();
        for id in stale {
            self.widgets.remove(&id);
            self.attached_listeners.remove(&id);
        }

        // 2. Pre-order walk: get-or-create widgets, update text/style, and
        //    reconcile each stack's child list/order.
        if let Some(root_id) = self.tree.root().map(|n| n.id) {
            self.sync_node(root_id);
        }
    }

    fn sync_node(&mut self, id: u32) {
        let Some(node) = self.tree.node(id).cloned() else {
            return;
        };

        let widget = self.get_or_create(id, &node);
        self.update(widget, &node);

        // Recurse into children (build them first so they exist to attach).
        let children = node.children.clone();
        for child in &children {
            self.sync_node(*child);
        }

        // Containers: reconcile the native children (order/content/positions)
        // against the tree.
        if is_container(node.component_type) {
            self.sync_container(id, &children, &node);
        }
    }

    fn get_or_create(&mut self, id: u32, node: &HostNode) -> gtk::Widget {
        if let Some(w) = self.widgets.get(&id) {
            return w.clone();
        }
        let widget = build_widget(node);
        self.widgets.insert(id, widget.clone());
        widget
    }

    /// Apply the current text/style/layout to an existing widget (idempotent).
    fn update(&mut self, widget: gtk::Widget, node: &HostNode) {
        // Padding is styling (a DSL modifier): apply it to any widget as margins.
        apply_padding(&widget, node);

        // Attach (or reconcile) native input recognition for the node's event
        // listeners. Buttons listen to pointer down/move/up by default; any
        // node can request more via the `EVENT_LISTENERS` property.
        let mask = desired_listeners(node);
        self.attach_listeners(node.id, &widget, mask);

        match node.component_type {
            component_type::VSTACK | component_type::HSTACK => {
                // Re-apply spacing on delta frames; orientation is fixed at
                // creation time (a component-type change recreates the widget).
                if let Ok(bx) = widget.downcast::<GtkBox>() {
                    if let Some(l) = layout::stack_layout(node) {
                        bx.set_spacing(l.spacing);
                    }
                }
            }
            component_type::TEXT => {
                if let Ok(label) = widget.downcast::<Label>() {
                    label.set_text(node.text.as_deref().unwrap_or(""));
                    apply_text_style(&label, node);
                }
            }
            component_type::BUTTON => {
                if let Ok(btn) = widget.downcast::<Button>() {
                    btn.set_label(node.text.as_deref().unwrap_or(""));
                }
            }
            component_type::IMAGE => {
                if let Ok(pic) = widget.downcast::<gtk::Picture>() {
                    if let Some(src) = node.string_property(property_id::IMAGE_SOURCE) {
                        pic.set_filename(Some(src));
                    }
                }
            }
            _ => {}
        }
    }

    /// Attach native input recognition for the listener bits not yet wired for
    /// `id`. Guarded by `attached_listeners` so delta frames don't double-attach.
    fn attach_listeners(&mut self, id: u32, widget: &gtk::Widget, mask: u32) {
        let attached = *self.attached_listeners.get(&id).unwrap_or(&0);
        let new = mask & !attached;
        if new == 0 {
            return;
        }
        if let Some(sink) = &self.event_sink {
            let sink = sink.clone();
            let want_down = new & listener::POINTER_DOWN != 0;
            let want_up = new & listener::POINTER_UP != 0;
            if want_down || want_up {
                attach_pointer_gesture(widget, id, sink.clone(), want_down, want_up);
            }
            if new & listener::POINTER_MOVE != 0 {
                attach_motion(widget, id, sink.clone());
            }
        }
        self.attached_listeners.insert(id, mask);
    }

    /// Reconcile a container's native children against the tree-ordered child
    /// widgets. Leaf widgets are preserved (never recreated); only the
    /// parent→child links are re-established, so unchanged subtrees stay put.
    fn sync_container(&mut self, parent_id: u32, children: &[u32], node: &HostNode) {
        match widget_kind(node.component_type) {
            WidgetKind::Stack => self.sync_stack_children(parent_id, children, node),
            WidgetKind::Grid => self.sync_grid_children(parent_id, children, node),
            WidgetKind::ScrollView => self.sync_scroll_children(parent_id, children),
            WidgetKind::Overlay => self.sync_overlay_children(parent_id, children),
            _ => {}
        }
    }

    /// Reconcile a stack's children: apply cross-axis alignment to each child
    /// and re-append the tree-ordered child widgets.
    fn sync_stack_children(&mut self, parent_id: u32, children: &[u32], node: &HostNode) {
        let Some(parent) = self.widgets.get(&parent_id).cloned() else {
            return;
        };
        let Some(_bx) = parent.downcast_ref::<GtkBox>() else {
            return;
        };
        let Some(l) = layout::stack_layout(node) else {
            return;
        };

        // Cross-axis alignment of each child: a vertical stack aligns children
        // horizontally (`halign`), a horizontal stack vertically (`valign`).
        for child_id in children {
            if let Some(w) = self.widgets.get(child_id) {
                if layout::cross_axis_is_horizontal(l.orientation) {
                    w.set_halign(l.child_align);
                } else {
                    w.set_valign(l.child_align);
                }
            }
        }

        self.reconcile_box_children(&parent, children);
    }

    /// Reconcile a `GtkGrid`'s children at their row-major cell positions.
    fn sync_grid_children(&mut self, parent_id: u32, children: &[u32], node: &HostNode) {
        let Some(parent) = self.widgets.get(&parent_id).cloned() else {
            return;
        };
        let Some(grid) = parent.downcast_ref::<gtk::Grid>() else {
            return;
        };
        let columns = layout::grid_columns(node);
        if grid_matches(grid, children, columns, &self.widgets) {
            return;
        }
        // Rebuild: remove all current children, then attach at target cells.
        for w in child_widgets(&parent) {
            grid.remove(&w);
        }
        for (idx, child_id) in children.iter().enumerate() {
            if let Some(w) = self.widgets.get(child_id) {
                let (row, col) = layout::grid_cell_position(idx as u32, columns);
                grid.attach(w, col as i32, row as i32, 1, 1);
            }
        }
    }

    /// Reconcile a `GtkScrolledWindow`: exactly one child (the first).
    fn sync_scroll_children(&mut self, parent_id: u32, children: &[u32]) {
        let Some(parent) = self.widgets.get(&parent_id).cloned() else {
            return;
        };
        let Some(sw) = parent.downcast_ref::<gtk::ScrolledWindow>() else {
            return;
        };
        let want: Option<gtk::Widget> = children
            .first()
            .and_then(|id| self.widgets.get(id).cloned());
        if sw.child().as_ref() != want.as_ref() {
            if let Some(w) = want {
                sw.set_child(Some(&w));
            } else {
                sw.set_child(None::<&gtk::Widget>);
            }
        }
    }

    /// Reconcile a `GtkOverlay`: the first child is the main child, the rest
    /// are overlays (later = drawn on top).
    fn sync_overlay_children(&mut self, parent_id: u32, children: &[u32]) {
        let Some(parent) = self.widgets.get(&parent_id).cloned() else {
            return;
        };
        let Some(ov) = parent.downcast_ref::<gtk::Overlay>() else {
            return;
        };
        let target: Vec<gtk::Widget> = children
            .iter()
            .filter_map(|id| self.widgets.get(id).cloned())
            .collect();
        if child_widgets(&parent) == target {
            return;
        }
        for w in child_widgets(&parent) {
            ov.remove_overlay(&w);
        }
        if let Some(main) = target.first() {
            ov.set_child(Some(main));
            for overlay in target.iter().skip(1) {
                ov.add_overlay(overlay);
            }
        }
    }

    /// Re-append the tree-ordered child widgets to a box (order/content diff).
    fn reconcile_box_children(&mut self, parent: &gtk::Widget, children: &[u32]) {
        let current = child_widgets(parent);
        let target: Vec<gtk::Widget> = children
            .iter()
            .filter_map(|id| self.widgets.get(id).cloned())
            .collect();
        if current == target {
            return;
        }
        if let Ok(bx) = parent.clone().downcast::<GtkBox>() {
            for w in current {
                bx.remove(&w);
            }
            for w in &target {
                bx.append(w);
            }
        }
    }
}

/// The native widget kind a component type maps to (pure, headless-testable).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WidgetKind {
    /// `VSTACK` / `HSTACK` → `GtkBox`.
    Stack,
    /// `TEXT` → `GtkLabel`.
    Text,
    /// `BUTTON` → `GtkButton`.
    Button,
    /// `GRID` → `GtkGrid`.
    Grid,
    /// `SCROLLVIEW` → `GtkScrolledWindow`.
    ScrollView,
    /// `ZSTACK` → `GtkOverlay`.
    Overlay,
    /// `SPACER` → an expanding empty box.
    Spacer,
    /// `IMAGE` → `GtkPicture`.
    Image,
    /// Any component the renderer does not map yet → a blank `GtkLabel`.
    Blank,
}

/// Map a component type to its native widget kind.
pub fn widget_kind(component_type: u16) -> WidgetKind {
    match component_type {
        component_type::VSTACK | component_type::HSTACK => WidgetKind::Stack,
        component_type::TEXT => WidgetKind::Text,
        component_type::BUTTON => WidgetKind::Button,
        component_type::GRID => WidgetKind::Grid,
        component_type::SCROLLVIEW => WidgetKind::ScrollView,
        component_type::ZSTACK => WidgetKind::Overlay,
        component_type::SPACER => WidgetKind::Spacer,
        component_type::IMAGE => WidgetKind::Image,
        _ => WidgetKind::Blank,
    }
}

/// Whether a component type reconciles native children (a container).
fn is_container(component_type: u16) -> bool {
    matches!(
        component_type,
        component_type::VSTACK
            | component_type::HSTACK
            | component_type::GRID
            | component_type::SCROLLVIEW
            | component_type::ZSTACK
    )
}

/// The current child widgets of a native widget, in child/draw order.
fn child_widgets(widget: &gtk::Widget) -> Vec<gtk::Widget> {
    let mut out = Vec::new();
    let mut c = widget.first_child();
    while let Some(w) = c {
        out.push(w.clone());
        c = w.next_sibling();
    }
    out
}

/// Whether a grid's children already sit at their target cell positions.
fn grid_matches(
    grid: &gtk::Grid,
    children: &[u32],
    columns: Option<u32>,
    widgets: &HashMap<u32, gtk::Widget>,
) -> bool {
    if child_widgets(&grid.clone().upcast()).len() != children.len() {
        return false;
    }
    for (idx, child_id) in children.iter().enumerate() {
        let Some(w) = widgets.get(child_id) else {
            return false;
        };
        let (row, col) = layout::grid_cell_position(idx as u32, columns);
        if grid.child_at(col as i32, row as i32).as_ref() != Some(w) {
            return false;
        }
    }
    true
}

/// Build the base native widget for a node (no children attached, no input
/// controllers — those are attached later in [`GtkRenderer::update`]).
fn build_widget(node: &HostNode) -> gtk::Widget {
    match widget_kind(node.component_type) {
        WidgetKind::Stack => stack_widget(node),
        WidgetKind::Text => Label::new(Some(node.text.as_deref().unwrap_or(""))).upcast(),
        WidgetKind::Button => Button::with_label(node.text.as_deref().unwrap_or("")).upcast(),
        WidgetKind::Grid => {
            let grid = gtk::Grid::new();
            grid.set_halign(Align::Fill);
            grid.set_valign(Align::Fill);
            grid.upcast()
        }
        WidgetKind::ScrollView => {
            let sw = gtk::ScrolledWindow::new();
            sw.set_halign(Align::Fill);
            sw.set_valign(Align::Fill);
            sw.set_policy(gtk::PolicyType::Automatic, gtk::PolicyType::Automatic);
            sw.upcast()
        }
        WidgetKind::Overlay => gtk::Overlay::new().upcast(),
        WidgetKind::Spacer => {
            let bx = GtkBox::new(gtk::Orientation::Vertical, 0);
            bx.set_hexpand(true);
            bx.set_vexpand(true);
            bx.upcast()
        }
        WidgetKind::Image => gtk::Picture::new().upcast(),
        WidgetKind::Blank => Label::new(Some("")).upcast(),
    }
}

/// The listener bitmask a node wants: buttons listen to pointer down/move/up by
/// default; any node can request additional (or different) raw events via the
/// `EVENT_LISTENERS` property.
fn desired_listeners(node: &HostNode) -> u32 {
    let mut mask = 0u32;
    if node.component_type == component_type::BUTTON {
        mask |= listener::POINTER_DOWN | listener::POINTER_MOVE | listener::POINTER_UP;
    }
    if let Some(m) = node.properties.get(&property_id::EVENT_LISTENERS) {
        mask |= *m;
    }
    mask
}

/// Attach a `GestureClick` to `widget`, reporting raw `POINTER_DOWN` /
/// `POINTER_UP` events for `target`. Uses the capture phase so it observes both
/// press and release even on a widget (like a button) whose own internal
/// gesture claims the click sequence.
fn attach_pointer_gesture(
    widget: &gtk::Widget,
    target: u32,
    sink: Rc<RefCell<dyn FnMut(Event)>>,
    want_down: bool,
    want_up: bool,
) {
    let gesture = GestureClick::new();
    gesture.set_propagation_phase(PropagationPhase::Capture);
    if want_down {
        let down_sink = sink.clone();
        gesture.connect_pressed(move |_, _n, x, y| {
            down_sink.borrow_mut()(Event::PointerDown {
                target,
                x: x as f32,
                y: y as f32,
                secondary: false,
            });
        });
    }
    if want_up {
        let up_sink = sink.clone();
        gesture.connect_released(move |_, _n, x, y| {
            up_sink.borrow_mut()(Event::PointerUp {
                target,
                x: x as f32,
                y: y as f32,
                secondary: false,
            });
        });
    }
    widget.add_controller(gesture);
}

/// Attach an `EventControllerMotion` to `widget`, reporting raw `POINTER_MOVE`
/// events (hover enter/move/leave) for `target`.
fn attach_motion(widget: &gtk::Widget, target: u32, sink: Rc<RefCell<dyn FnMut(Event)>>) {
    let motion = EventControllerMotion::new();
    let move_sink = sink.clone();
    motion.connect_motion(move |_motion, x, y| {
        move_sink.borrow_mut()(Event::PointerMove {
            target,
            x: x as f32,
            y: y as f32,
            hovering: true,
            leaving: false,
        });
    });
    let enter_sink = sink.clone();
    motion.connect_enter(move |_motion, x, y| {
        enter_sink.borrow_mut()(Event::PointerMove {
            target,
            x: x as f32,
            y: y as f32,
            hovering: true,
            leaving: false,
        });
    });
    let leave_sink = sink.clone();
    motion.connect_leave(move |_motion| {
        leave_sink.borrow_mut()(Event::PointerMove {
            target,
            x: 0.0,
            y: 0.0,
            hovering: false,
            leaving: true,
        });
    });
    widget.add_controller(motion);
}

/// Build a stack's native `GtkBox` from its mapped layout (orientation +
/// spacing). Padding is applied later, in `update`, so the spacing here is the
/// only stack-specific layout decision made at creation time.
fn stack_widget(node: &HostNode) -> gtk::Widget {
    let layout = layout::stack_layout(node).expect("stack component");
    let bx = GtkBox::new(layout.orientation, layout.spacing);
    bx.set_halign(Align::Fill);
    bx.set_valign(Align::Fill);
    bx.upcast()
}

/// Apply a node's padding as widget margins (styling, any widget type).
fn apply_padding(widget: &gtk::Widget, node: &HostNode) {
    let e = layout::padding_from(node);
    if e.is_zero() {
        return;
    }
    widget.set_margin_top(e.top);
    widget.set_margin_end(e.right);
    widget.set_margin_bottom(e.bottom);
    widget.set_margin_start(e.left);
}

/// Apply color/font-size text style from properties via Pango attributes.
fn apply_text_style(label: &Label, node: &HostNode) {
    let attrs = pango::AttrList::new();
    if let Some(fs) = node.properties.get(&property_id::FONT_SIZE) {
        let pts = (f32::from_bits(*fs).max(0.0) as i32) * 1000;
        attrs.insert(pango::AttrSize::new(pts));
    }
    if let Some(color) = node.properties.get(&property_id::COLOR) {
        let c = *color;
        let red = (((c >> 16) & 0xFF) as u16) * 257;
        let green = (((c >> 8) & 0xFF) as u16) * 257;
        let blue = ((c & 0xFF) as u16) * 257;
        let mut fg = pango::AttrColor::new_foreground(red, green, blue);
        fg.set_start_index(0);
        fg.set_end_index(u32::MAX);
        attrs.insert(fg);
    }
    label.set_attributes(Some(&attrs));
}

/// Run the GTK renderer over a shared ring, pumping frames in and waking the
/// host on raw-input events.
///
/// `on_event` is invoked (on the GTK main thread) with the shared ring whenever
/// the renderer wrote a raw input; the app drains the ring's event queue itself
/// (`RingTransport::drain_events`) and may re-emit a new frame.
///
/// Passes the process's real program args to GTK (a native Rust binary's args
/// are just its program name — safe for GTK to parse).
pub fn run<F>(app_id: &str, title: &str, ring: Rc<RefCell<RingTransport>>, on_event: F)
where
    F: FnMut(Rc<RefCell<RingTransport>>) + 'static,
{
    let args: Vec<String> = std::env::args().collect();
    let args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    run_with_pump(app_id, title, ring, &args, on_event);
}

/// Generic [`run`] over any [`Pump`] (e.g. a `pathland-view-native` host handle).
///
/// `args` is passed verbatim to `g_application_run`. Embedding hosts must pass
/// an argv that is NOT their own process command line when that command line
/// carries foreign options (e.g. the JVM's `-cp`/`-D` flags).
pub fn run_with_pump<P, F>(
    app_id: &str,
    title: &str,
    pump: Rc<RefCell<P>>,
    args: &[&str],
    on_event: F,
) where
    P: Pump + 'static,
    F: FnMut(Rc<RefCell<P>>) + 'static,
{
    let app_id = app_id.to_string();
    let title = title.to_string();
    let on_event = Rc::new(RefCell::new(on_event));

    let app = gtk::Application::builder().application_id(&app_id).build();

    app.connect_activate(move |app| {
        let window = gtk::ApplicationWindow::builder()
            .application(app)
            .title(&title)
            .default_width(420)
            .default_height(220)
            .build();

        let renderer = Rc::new(RefCell::new(GtkRenderer::new()));

        // Native inputs are written as EVENT opcodes into the pump (host → guest);
        // the host is then woken to drain the event ring itself.
        {
            let pump_for_buttons = pump.clone();
            let wake = on_event.clone();
            let sink: Rc<RefCell<dyn FnMut(Event)>> =
                Rc::new(RefCell::new(move |ev: Event| {
                    {
                        let mut p = pump_for_buttons.borrow_mut();
                        let _ = p.send_input(&ev);
                    }
                    wake.borrow_mut()(pump_for_buttons.clone());
                }));
            renderer.borrow_mut().set_event_sink(sink);
        }

        // Initial render + window root.
        pump_once(&renderer, &pump);
        let root = renderer.borrow().root_widget();
        if let Some(root) = root {
            window.set_child(Some(&root));
        }
        window.present();

        // Idle pump: apply pending frames to the renderer. Events are drained by
        // the host (woken from the sink above), not here.
        let idle_renderer = renderer.clone();
        let idle_pump = pump.clone();
        glib::idle_add_local(move || {
            pump_once(&idle_renderer, &idle_pump);
            glib::ControlFlow::Continue
        });
    });

    // Run the GTK main loop with the caller-provided argv.
    app.run_with_args(args);
}

/// Apply pending frames to the renderer. (Events flow the other way: the
/// renderer writes them; the host drains them — see [`Pump`].)
fn pump_once<P>(renderer: &Rc<RefCell<GtkRenderer>>, pump: &Rc<RefCell<P>>)
where
    P: Pump,
{
    loop {
        let mut pump_ref = pump.borrow_mut();
        match pump_ref.next_frame() {
            Ok(Some(batch)) => {
                let frame = batch.frame();
                renderer.borrow_mut().apply_frame(frame);
            }
            _ => break,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use pathland_engine::Engine;
    use pathland_core::{init_memory, Guest, MemoryLayout};
    use pathland_view::{assign_ids, text, vstack, View, ViewExt};

    #[test]
    fn render_tree_decodes_a_frame() {
        // Build a tree, emit into a ring, decode via RenderTree (the renderer's
        // underlying store) without touching GTK.
        let layout = MemoryLayout::default();
        let mut mem = vec![0u8; layout.total_bytes()];
        init_memory(&mut mem, &layout);

        let mut root = vstack![text("ab"), text("cd")]
            .spacing(4.0)
            .build();
        assign_ids(&mut root, &mut 1);

        let mut engine = Engine::new();
        {
            let mut guest = Guest::new(&mut mem, &layout);
            guest.begin_frame();
            engine.emit(&root, &mut guest).unwrap();
            guest.end_frame();
        }

        let mut host = pathland_core::Host::new(&mut mem, &layout);
        let frames = host.frames();
        let mut tree = RenderTree::default();
        tree.apply_frame(&frames[0]);
        assert_eq!(tree.nodes.len(), 3);
        assert_eq!(tree.node(1).unwrap().component_type, component_type::VSTACK);
    }

    #[test]
    fn renderer_placeholder_compiles() {
        // Ensures the renderer type is constructible without a display.
        let _r = GtkRenderer::new();
    }

    #[test]
    fn widget_kind_maps_grouped_components() {
        use component_type::*;
        assert_eq!(widget_kind(VSTACK), WidgetKind::Stack);
        assert_eq!(widget_kind(HSTACK), WidgetKind::Stack);
        assert_eq!(widget_kind(TEXT), WidgetKind::Text);
        assert_eq!(widget_kind(BUTTON), WidgetKind::Button);
        assert_eq!(widget_kind(GRID), WidgetKind::Grid);
        assert_eq!(widget_kind(SCROLLVIEW), WidgetKind::ScrollView);
        assert_eq!(widget_kind(ZSTACK), WidgetKind::Overlay);
        assert_eq!(widget_kind(SPACER), WidgetKind::Spacer);
        assert_eq!(widget_kind(IMAGE), WidgetKind::Image);
        // Components without a mapping fall back to a blank widget.
        assert_eq!(widget_kind(TOGGLE), WidgetKind::Blank);
        assert_eq!(widget_kind(SLIDER), WidgetKind::Blank);
        assert_eq!(widget_kind(COMMENT), WidgetKind::Blank);
    }

    #[test]
    fn container_kinds_are_recognized() {
        use component_type::*;
        for ct in [VSTACK, HSTACK, GRID, SCROLLVIEW, ZSTACK] {
            assert!(is_container(ct), "{ct:#x} should be a container");
        }
        for ct in [TEXT, BUTTON, SPACER, IMAGE, TOGGLE, SLIDER] {
            assert!(!is_container(ct), "{ct:#x} should not be a container");
        }
    }

    #[test]
    fn stack_layout_maps_from_opcode_frames() {
        // Hand-crafted opcode frames (not the DSL) drive the renderer's
        // RenderTree + pure layout mapping, exercising spacing/alignment/
        // padding - including a delta frame - without touching GTK widgets.
        use pathland_core::{Host, APPEND, component_type, property_id, value_type};

        let layout = MemoryLayout::default();
        let mut mem = vec![0u8; layout.total_bytes()];
        init_memory(&mut mem, &layout);

        // Frame 1: VSTACK (id 1) with SPACING=4, ALIGNMENT=Center, PADDING=8
        // with a PADDING_TOP override of 2; child TEXT (id 2).
        {
            let mut guest = Guest::new(&mut mem, &layout);
            guest.begin_frame();
            guest.create_node(1, component_type::VSTACK).unwrap();
            guest
                .set_property(1, property_id::SPACING, value_type::F32, 4.0f32.to_bits())
                .unwrap();
            guest
                .set_property(1, property_id::ALIGNMENT, value_type::F32, 1.0f32.to_bits())
                .unwrap();
            guest
                .set_property(1, property_id::PADDING, value_type::F32, 8.0f32.to_bits())
                .unwrap();
            guest
                .set_property(1, property_id::PADDING_TOP, value_type::F32, 2.0f32.to_bits())
                .unwrap();
            guest.create_node(2, component_type::TEXT).unwrap();
            guest.insert_child(1, 2, APPEND).unwrap();
            guest.set_text(2, "hi").unwrap();
            guest.end_frame();
        }

        let mut tree = RenderTree::default();
        {
            let mut host = Host::new(&mut mem, &layout);
            tree.apply_frame(&host.frames()[0]);
        }

        let root = tree.root().unwrap().clone();
        let l = crate::layout::stack_layout(&root).unwrap();
        assert_eq!(l.orientation, gtk::Orientation::Vertical);
        assert_eq!(l.spacing, 4);
        assert_eq!(l.child_align, Align::Center);
        assert_eq!(
            crate::layout::padding_from(&root),
            crate::layout::Edges { top: 2, right: 8, bottom: 8, left: 8 }
        );

        // Frame 2 (delta): SPACING 4->12, ALIGNMENT Center->End.
        {
            let mut guest = Guest::new(&mut mem, &layout);
            guest.begin_frame();
            guest
                .set_property(1, property_id::SPACING, value_type::F32, 12.0f32.to_bits())
                .unwrap();
            guest
                .set_property(1, property_id::ALIGNMENT, value_type::F32, 2.0f32.to_bits())
                .unwrap();
            guest.end_frame();
        }
        {
            let mut host = Host::new(&mut mem, &layout);
            tree.apply_frame(&host.frames()[0]);
        }

        let root = tree.root().unwrap().clone();
        let l = crate::layout::stack_layout(&root).unwrap();
        assert_eq!(l.spacing, 12);
        assert_eq!(l.child_align, Align::End);
    }
}
