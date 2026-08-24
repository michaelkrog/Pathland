//! Round-trip: WaterUI view → opcodes → retained description.

use pathland_core::{component_type, property_id};
use pathland_core_transport::FrameSource;
use pathland_waterui::{Consumer, Emitter};
use waterui_controls::button::button;
use waterui_core::{Environment, View, binding};
use waterui_layout::stack::vstack;
use waterui_text::text::text;

fn drain(emitter: &Emitter, consumer: &mut Consumer) {
    let transport = emitter.transport();
    let mut borrow = transport.borrow_mut();
    while let Ok(Some(batch)) = borrow.next_frame() {
        consumer.apply(batch.frame());
    }
}

fn emit_and_decode(view: impl View, env: &Environment) -> (u32, Consumer) {
    let mut emitter = Emitter::new();
    let root = emitter.emit(view, env).expect("emit");
    let mut consumer = Consumer::new();
    drain(&emitter, &mut consumer);
    (root, consumer)
}

#[test]
fn vstack_of_text_round_trips() {
    let env = Environment::new();
    let (root, consumer) = emit_and_decode(vstack((text("hello"), text("world"))), &env);

    assert_eq!(consumer.len(), 3);

    let root_node = consumer.node(root).expect("root node");
    assert_eq!(root_node.component, component_type::VSTACK);
    assert_eq!(root_node.children.len(), 2);

    let first = consumer.node(root_node.children[0]).expect("first child");
    assert_eq!(first.component, component_type::TEXT);
    assert_eq!(first.text.as_deref(), Some("hello"));

    let second = consumer.node(root_node.children[1]).expect("second child");
    assert_eq!(second.component, component_type::TEXT);
    assert_eq!(second.text.as_deref(), Some("world"));
}

#[test]
fn hstack_of_text_round_trips() {
    let env = Environment::new();
    let view = waterui_layout::stack::hstack((text("a"), text("b")));
    let (root, consumer) = emit_and_decode(view, &env);

    let root_node = consumer.node(root).expect("root node");
    assert_eq!(root_node.component, component_type::HSTACK);
    assert_eq!(root_node.children.len(), 2);
}

#[test]
fn rebuild_is_lossless() {
    // Emit → decode → rebuild → re-emit → decode must reproduce the same
    // structure (the protocol survives a full round trip through WaterUI).
    let env = Environment::new();
    let original = vstack((text("hello"), text("world")));

    let (root, consumer) = emit_and_decode(original, &env);

    let rebuilt = consumer.rebuild(root).expect("rebuild root");
    let (_root2, consumer2) = emit_and_decode(rebuilt, &env);

    assert_eq!(consumer, consumer2);
}

#[test]
fn reactive_text_emits_delta() {
    let env = Environment::new();
    let count: waterui_core::Binding<&'static str> = binding("zero");
    let view = vstack((text(count.clone()), text("static")));

    let mut emitter = Emitter::new();
    let root = emitter.emit(view, &env).expect("emit");

    let mut consumer = Consumer::new();
    drain(&emitter, &mut consumer);

    let first_id = consumer.node(root).expect("root").children[0];
    assert_eq!(
        consumer.node(first_id).expect("first").text.as_deref(),
        Some("zero")
    );

    // Change the binding; the producer must emit a SET_TEXT delta for the node.
    count.set("one");
    drain(&emitter, &mut consumer);

    assert_eq!(
        consumer.node(first_id).expect("first").text.as_deref(),
        Some("one")
    );
}

#[test]
fn button_round_trips() {
    let env = Environment::new();
    let view = vstack((button("Click me"), text("after")));
    let (root, consumer) = emit_and_decode(view, &env);

    let root_node = consumer.node(root).expect("root");
    let button_node = consumer
        .node(root_node.children[0])
        .expect("button child");
    assert_eq!(button_node.component, component_type::BUTTON);
    assert_eq!(button_node.text.as_deref(), Some("Click me"));
}

#[test]
fn spacing_is_emitted() {
    let env = Environment::new();
    let view = vstack((text("a"), text("b"))).spacing(16.0);
    let (root, consumer) = emit_and_decode(view, &env);

    let root_node = consumer.node(root).expect("root");
    let bits = root_node
        .properties
        .get(&property_id::SPACING)
        .copied()
        .expect("spacing property");
    assert_eq!(f32::from_bits(bits), 16.0);
}
