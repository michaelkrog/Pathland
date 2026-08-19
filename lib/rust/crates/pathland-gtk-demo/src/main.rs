//! # Pathland GTK4 desktop demo
//!
//! A native GTK4 app demonstrating Pathland's **zero-copy shared-memory ring**.
//!
//! The developer authors the UI with the SwiftUI-style DSL; the native
//! `pathland_engine` emits declarative 16-byte opcodes into a shared linear
//! memory ring (`RingTransport`). The driver reads completed frames back from
//! the same ring — no serialization, no batching, no copies — and renders to
//! native GTK widgets.
//!
//! This is the local/desktop transport: producer (engine) and consumer (driver)
//! share one address space. Remote rendering (WebSocket/batch) is a separate
//! transport used by SSR — see `pathland-transport`.

use std::cell::RefCell;
use std::rc::Rc;

use gtk::prelude::*;
use gtk::{Align, Application, ApplicationWindow, Box as GtkBox, Label, Orientation};
use pathland_engine::Engine;
use pathland_host::RenderTree;
use pathland_transport::{FrameSource, RingTransport};
use pathland_opcode::size;
use pathland_view::Align as ViewAlign;
use pathland_view::{assign_ids, button, hstack, text, vstack, Node, View, ViewExt};

const APP_ID: &str = "org.pathland.GtkDemo";

/// Build the DSL tree for the current counter value. This is the developer's
/// authoring surface.
fn build_tree(count: u32) -> Node {
    vstack![
        hstack![
            text(format!("Count: {}", count).as_str())
                .frame(Some(size::FILL), None, Some(ViewAlign::Leading)),
            button("Increment"),
        ]
        .padding(16.0),
        text("Pathland · GTK4 · shared ring").color(0xFF_888888),
    ]
    .padding(24.0)
    .build()
}

/// Demo state: the diff-based engine + the shared ring it writes into.
struct Demo {
    engine: Engine,
    ring: RingTransport,
    count: u32,
    /// Button-click callback (set once during UI setup).
    on_click: Option<Rc<dyn Fn()>>,
}

fn main() {
    let app = Application::builder().application_id(APP_ID).build();
    app.connect_activate(build_ui);
    app.run();
}

fn build_ui(app: &Application) {
    // Shared app state (mutable through Rc<RefCell> across callbacks).
    let demo = Rc::new(RefCell::new(Demo {
        engine: Engine::new(),
        ring: RingTransport::new(),
        count: 0,
        on_click: None,
    }));

    let window = ApplicationWindow::builder()
        .application(app)
        .title("Pathland GTK4 Demo")
        .default_width(420)
        .default_height(220)
        .build();

    let root = GtkBox::new(Orientation::Vertical, 0);
    window.set_child(Some(&root));

    // Initial render through the shared ring.
    let demo_ren = Rc::clone(&demo);
    let root_ren = root.clone();
    let re_render = move || render(&demo_ren, &root_ren);
    re_render();

    // Button click: apply state change, then re-render through the ring.
    let demo_click = Rc::clone(&demo);
    let root_click = root.clone();
    let on_click: Rc<dyn Fn()> = Rc::new(move || {
        let mut d = demo_click.borrow_mut();
        d.count = d.count.wrapping_add(1);
        drop(d);
        render(&demo_click, &root_click);
    });
    demo.borrow_mut().on_click = Some(on_click);

    window.present();
}

/// Pipeline: DSL -> engine -> shared ring -> RenderTree -> GTK widgets.
///
/// The engine writes opcodes into the ring's producer view; the driver reads
/// the completed frame from the same ring via `FrameSource`. Zero-copy.
fn render(demo: &Rc<RefCell<Demo>>, root: &GtkBox) {
    let mut d = demo.borrow_mut();
    let on_click: Option<Rc<dyn Fn()>> = d.on_click.clone();
    let mut tree = build_tree(d.count);
    assign_ids(&mut tree, &mut 1);

    // Disjoint field borrows: engine (producer state) and ring (transport).
    let Demo {
        engine,
        ring,
        count: _,
        on_click: _,
    } = &mut *d;

    // 1. Producer writes opcodes into the shared ring.
    {
        let mut guest = ring.producer();
        guest.begin_frame();
        engine.emit(&tree, &mut guest).ok();
        guest.end_frame();
    }

    // 2. Consumer reads the completed frame from the same ring.
    let frame = ring.next_frame().ok().flatten().expect("a frame after emit");
    let frame = frame.frame();

    // 3. Apply the frame to the native-element description.
    let mut render = RenderTree::default();
    render.apply_frame(frame);

    // 4. Rebuild the GTK widget hierarchy.
    while let Some(child) = root.first_child() {
        root.remove(&child);
    }
    if let Some(root_node_id) = render.root().map(|n| n.id) {
        root.append(&render_node(&render, root_node_id, on_click));
    }
    root.show();
}

/// Build a GTK widget subtree for a node id from the `RenderTree`.
fn render_node(render: &RenderTree, id: u32, on_click: Option<Rc<dyn Fn()>>) -> gtk::Widget {
    let node = render.node(id).unwrap();
    match node.component_type {
        pathland_opcode::component_type::VSTACK => {
            let bx = GtkBox::new(Orientation::Vertical, spacing(render, id));
            bx.set_halign(Align::Fill);
            bx.set_valign(Align::Fill);
            for child in &node.children {
                bx.append(&render_node(render, *child, on_click.clone()));
            }
            bx.upcast()
        }
        pathland_opcode::component_type::HSTACK => {
            let bx = GtkBox::new(Orientation::Horizontal, spacing(render, id));
            bx.set_halign(Align::Center);
            bx.set_valign(Align::Center);
            for child in &node.children {
                bx.append(&render_node(render, *child, on_click.clone()));
            }
            bx.upcast()
        }
        pathland_opcode::component_type::TEXT => {
            let label = Label::new(Some(node.text.as_deref().unwrap_or("")));
            apply_text_style(&label, render, id);
            label.upcast()
        }
        pathland_opcode::component_type::BUTTON => {
            let btn = gtk::Button::with_label(node.text.as_deref().unwrap_or(""));
            if let Some(cb) = on_click {
                btn.connect_clicked(move |_| cb());
            }
            btn.upcast()
        }
        _ => Label::new(Some("")).upcast(),
    }
}

/// Spacing property value for a node (default 4).
fn spacing(render: &RenderTree, id: u32) -> i32 {
    render
        .node(id)
        .and_then(|n| n.properties.get(&pathland_opcode::property_id::SPACING))
        .map(|b| f32::from_bits(*b) as i32)
        .unwrap_or(4)
}

/// Apply color/font-size text style from properties via Pango attributes.
fn apply_text_style(label: &Label, render: &RenderTree, id: u32) {
    let node = render.node(id).unwrap();
    let attrs = pango::AttrList::new();
    if let Some(fs) = node.properties.get(&pathland_opcode::property_id::FONT_SIZE) {
        // Font size is stored in points (f32); pango scales points to device units.
        let pts = (f32::from_bits(*fs).max(0.0) as i32) * 1000;
        attrs.insert(pango::AttrSize::new(pts));
    }
    if let Some(color) = node.properties.get(&pathland_opcode::property_id::COLOR) {
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
