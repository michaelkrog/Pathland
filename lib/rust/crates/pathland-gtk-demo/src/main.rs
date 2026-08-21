//! # Pathland GTK4 desktop demo
//!
//! A native GTK4 app demonstrating Pathland's **zero-copy shared-memory ring**
//! and the shared **GTK renderer** (`pathland-gtk`).
//!
//! The developer authors the UI with the SwiftUI-style DSL; the
//! `pathland_engine` emits declarative 16-byte opcodes into the shared ring, and
//! the `pathland-gtk` renderer maps them onto native GTK widgets. The demo never
//! touches GTK/glib/pango directly — it only drives Pathland and the renderer.

use std::cell::RefCell;
use std::rc::Rc;

use pathland_engine::Engine;
use pathland_opcode::size;
use pathland_transport::RingTransport;
use pathland_view::{assign_ids, button, hstack, text, vstack, Align, Node, View, ViewExt};

const APP_ID: &str = "org.pathland.GtkDemo";

/// Build the DSL tree for the current counter value. This is the developer's
/// authoring surface.
fn build_tree(count: u32) -> Node {
    vstack![
        hstack![
            text(format!("Count: {}", count).as_str()).frame(Some(size::FILL), None, None),
            button("Increment"),
        ]
        .spacing(8.0)
        .padding(16.0),
        text("Pathland · GTK4 · shared ring").color(0xFF_888888),
        // A VStack whose children (different widths) are centered on the
        // cross axis, exercising ALIGNMENT.
        vstack![
            text("short"),
            text("a much longer label"),
            text("x"),
        ]
        .spacing(4.0)
        .padding(16.0)
        .frame(None, None, Some(Align::Center)),
    ]
    .spacing(12.0)
    .padding(24.0)
    .build()
}

/// Emit the current tree as opcodes into the shared ring.
fn emit(engine: &Rc<RefCell<Engine>>, ring: &Rc<RefCell<RingTransport>>, count: u32) {
    let mut tree = build_tree(count);
    assign_ids(&mut tree, &mut 1);
    let mut ring_ref = ring.borrow_mut();
    let mut guest = ring_ref.producer();
    guest.begin_frame();
    engine.borrow_mut().emit(&tree, &mut guest).ok();
    guest.end_frame();
}

fn main() {
    let engine = Rc::new(RefCell::new(Engine::new()));
    let ring = Rc::new(RefCell::new(RingTransport::new()));
    let count = Rc::new(RefCell::new(0u32));

    // Initial frame before the renderer starts pumping.
    emit(&engine, &ring, 0);

    // Hand the renderer the shared ring and a wake handler. The renderer writes
    // native inputs as EVENT opcodes into the ring and wakes us; we drain the
    // ring, react to pointer-up, bump the counter, and re-emit. The renderer's
    // idle pump applies the delta.
    pathland_gtk::run(APP_ID, "Pathland GTK4 Demo", ring.clone(), {
        let engine = engine.clone();
        let count = count.clone();
        move |ring| {
            let events = ring.borrow_mut().drain_events();
            let activated = events
                .iter()
                .any(|ev| matches!(ev, pathland_opcode::Event::PointerUp { .. }));
            if activated {
                *count.borrow_mut() += 1;
                emit(&engine, &ring, *count.borrow());
            }
        }
    });
}
