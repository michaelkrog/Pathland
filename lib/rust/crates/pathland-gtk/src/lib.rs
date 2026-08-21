//! # pathland-gtk
//!
//! The Pathland **GTK4 renderer**. It consumes opcode frames (via
//! `pathland_host::RenderTree`) and maps them **incrementally** onto native GTK4
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
//! in-process over the `pathland-native` host's shared ring.

mod capi;
mod layout;

use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;

use gtk::prelude::*;
use gtk::{Align, Box as GtkBox, Button, Label};
use pathland_host::{HostNode, RenderTree};
use pathland_opcode::{component_type, property_id, Event, Frame};
use pathland_transport::{DriverTransport, FrameSource, OpcodeBatch, RingTransport, TransportError};

/// Callback the renderer invokes with a decoded raw-input event.
pub type EventHandler = Box<dyn FnMut(Event)>;

/// The bidirectional transport surface the renderer pumps: frames in
/// (guest → host) and events out (host → guest).
pub trait Pump {
    /// Read the next guest → host frame.
    fn next_frame(&mut self) -> Result<Option<OpcodeBatch<'_>>, TransportError>;
    /// Write a host → guest raw input.
    fn send_input(&mut self, event: &Event) -> Result<(), TransportError>;
    /// Drain pending host → guest raw inputs.
    fn drain_events(&mut self) -> Vec<Event>;
}

impl Pump for RingTransport {
    fn next_frame(&mut self) -> Result<Option<OpcodeBatch<'_>>, TransportError> {
        FrameSource::next_frame(self)
    }
    fn send_input(&mut self, event: &Event) -> Result<(), TransportError> {
        DriverTransport::send_input(self, event)
    }
    fn drain_events(&mut self) -> Vec<Event> {
        RingTransport::drain_events(self)
    }
}

/// The GTK4 renderer: a retained `id → gtk::Widget` map kept in sync with the
/// opcode stream, applying deltas incrementally.
pub struct GtkRenderer {
    tree: RenderTree,
    widgets: HashMap<u32, gtk::Widget>,
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

        // Stacks: reconcile the box children (order/content) against the tree
        // and apply cross-axis alignment to each child.
        if matches!(
            node.component_type,
            component_type::VSTACK | component_type::HSTACK
        ) {
            self.sync_children(id, &children, &node);
        }
    }

    fn get_or_create(&mut self, id: u32, node: &HostNode) -> gtk::Widget {
        if let Some(w) = self.widgets.get(&id) {
            return w.clone();
        }
        let widget = build_widget(node, &self.event_sink);
        self.widgets.insert(id, widget.clone());
        widget
    }

    /// Apply the current text/style/layout to an existing widget (idempotent).
    fn update(&self, widget: gtk::Widget, node: &HostNode) {
        // Padding is styling (a DSL modifier): apply it to any widget as margins.
        apply_padding(&widget, node);

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
            _ => {}
        }
    }

    /// Reconcile a stack's children: apply cross-axis alignment to each child
    /// and re-append the tree-ordered child widgets.
    ///
    /// Leaf widgets are preserved (never recreated); only the parent→child
    /// links are re-established, so unchanged subtrees stay put.
    fn sync_children(&mut self, parent_id: u32, children: &[u32], node: &HostNode) {
        let Some(parent) = self.widgets.get(&parent_id).cloned() else {
            return;
        };
        let Some(bx) = parent.downcast_ref::<GtkBox>() else {
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

        // Current children in order.
        let mut current: Vec<gtk::Widget> = Vec::new();
        let mut c = bx.first_child();
        while let Some(w) = c {
            current.push(w.clone());
            c = w.next_sibling();
        }

        // Target widgets in tree order.
        let target: Vec<gtk::Widget> = children
            .iter()
            .filter_map(|id| self.widgets.get(id).cloned())
            .collect();

        if current != target {
            for w in current {
                bx.remove(&w);
            }
            for w in &target {
                bx.append(w);
            }
        }
    }
}

/// Build the base native widget for a node (no children attached).
fn build_widget(
    node: &HostNode,
    event_sink: &Option<Rc<RefCell<dyn FnMut(Event)>>>,
) -> gtk::Widget {
    match node.component_type {
        component_type::VSTACK | component_type::HSTACK => stack_widget(node),
        component_type::TEXT => Label::new(Some(node.text.as_deref().unwrap_or(""))).upcast(),
        component_type::BUTTON => {
            let btn = Button::with_label(node.text.as_deref().unwrap_or(""));
            let target = node.id;
            if let Some(sink) = event_sink {
                let sink = sink.clone();
                btn.connect_clicked(move |_| {
                    let mut sink = sink.borrow_mut();
                    sink(Event::PointerUp {
                        target,
                        x: 0.0,
                        y: 0.0,
                        secondary: false,
                    });
                });
            }
            btn.upcast()
        }
        _ => Label::new(Some("")).upcast(),
    }
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

/// Run the GTK renderer over a shared ring, pumping frames in and events out.
///
/// `on_event` is invoked (on the GTK main thread) with each decoded raw-input
/// event; it receives the shared ring so the app can re-emit a new frame.
///
/// Passes the process's real program args to GTK (a native Rust binary's args
/// are just its program name — safe for GTK to parse).
pub fn run<F>(app_id: &str, title: &str, ring: Rc<RefCell<RingTransport>>, on_event: F)
where
    F: FnMut(Event, Rc<RefCell<RingTransport>>) + 'static,
{
    let args: Vec<String> = std::env::args().collect();
    let args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    run_with_pump(app_id, title, ring, &args, on_event);
}

/// Generic [`run`] over any [`Pump`] (e.g. a `pathland-native` host handle).
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
    F: FnMut(Event, Rc<RefCell<P>>) + 'static,
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

        // Buttons report clicks as EVENT opcodes into the pump (host → guest).
        {
            let pump_for_buttons = pump.clone();
            let sink: Rc<RefCell<dyn FnMut(Event)>> =
                Rc::new(RefCell::new(move |ev: Event| {
                    let mut p = pump_for_buttons.borrow_mut();
                    let _ = p.send_input(&ev);
                }));
            renderer.borrow_mut().set_event_sink(sink);
        }

        // Initial render + window root.
        pump_once(&renderer, &pump, &mut |_, _| {});
        let root = renderer.borrow().root_widget();
        if let Some(root) = root {
            window.set_child(Some(&root));
        }
        window.present();

        // Idle pump: drain events (dispatch to app) then drain frames (render).
        // Clone the Rc handles so the outer `Fn` closure never moves them out.
        let idle_renderer = renderer.clone();
        let idle_pump = pump.clone();
        let idle_on_event = on_event.clone();
        glib::idle_add_local(move || {
            pump_once(&idle_renderer, &idle_pump, &mut |ev, p| {
                idle_on_event.borrow_mut()(ev, p);
            });
            glib::ControlFlow::Continue
        });
    });

    // Run the GTK main loop with the caller-provided argv.
    app.run_with_args(args);
}

/// Drain the shared pump once: dispatch pending events to `on_event`, then
/// apply pending frames to the renderer.
fn pump_once<P, F>(renderer: &Rc<RefCell<GtkRenderer>>, pump: &Rc<RefCell<P>>, on_event: &mut F)
where
    P: Pump,
    F: FnMut(Event, Rc<RefCell<P>>),
{
    // Events first (the app may re-emit inside the callback).
    let events = pump.borrow_mut().drain_events();
    for ev in events {
        on_event(ev, pump.clone());
    }

    // Frames next.
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
    use pathland_opcode::{init_memory, Guest, MemoryLayout};
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

        let mut host = pathland_opcode::Host::new(&mut mem, &layout);
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
    fn stack_layout_maps_from_opcode_frames() {
        // Hand-crafted opcode frames (not the DSL) drive the renderer's
        // RenderTree + pure layout mapping, exercising spacing/alignment/
        // padding - including a delta frame - without touching GTK widgets.
        use pathland_opcode::{Host, APPEND, component_type, property_id, value_type};

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
