//! Round-trip: WaterUI view → opcodes → retained description.

use pathland_core::{component_type, init_memory, Guest, Host, MemoryLayout};
use pathland_waterui::{Consumer, Emitter};
use waterui_core::{Environment, View};
use waterui_layout::stack::vstack;
use waterui_text::text::text;

fn emit_and_decode(view: impl View, env: &Environment) -> (u32, Consumer) {
    let layout = MemoryLayout::default();
    let mut mem = vec![0u8; layout.total_bytes()];
    init_memory(&mut mem, &layout);

    let root = {
        let mut emitter = Emitter::new(Guest::new(&mut mem, &layout));
        emitter.emit(view, env).expect("emit")
    };

    let mut host = Host::new(&mut mem, &layout);
    let mut consumer = Consumer::new();
    for frame in host.frames() {
        consumer.apply(&frame);
    }
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
