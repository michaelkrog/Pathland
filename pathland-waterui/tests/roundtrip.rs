//! Round-trip: WaterUI view → opcodes → retained description.

use pathland_core::{component_type, init_memory, Guest, Host, MemoryLayout};
use pathland_waterui::{Consumer, Emitter};
use waterui_core::Environment;
use waterui_layout::stack::vstack;
use waterui_text::text::text;

#[test]
fn vstack_of_text_round_trips() {
    let env = Environment::new();
    let view = vstack((text("hello"), text("world")));

    let layout = MemoryLayout::default();
    let mut mem = vec![0u8; layout.total_bytes()];
    init_memory(&mut mem, &layout);

    let root = {
        let mut emitter = Emitter::new(Guest::new(&mut mem, &layout));
        emitter.emit(view, &env).expect("emit")
    };

    let mut host = Host::new(&mut mem, &layout);
    let frames = host.frames();
    assert_eq!(frames.len(), 1);

    let mut consumer = Consumer::new();
    consumer.apply(&frames[0]);

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

    let layout = MemoryLayout::default();
    let mut mem = vec![0u8; layout.total_bytes()];
    init_memory(&mut mem, &layout);

    let root = {
        let mut emitter = Emitter::new(Guest::new(&mut mem, &layout));
        emitter.emit(view, &env).expect("emit")
    };

    let mut host = Host::new(&mut mem, &layout);
    let mut consumer = Consumer::new();
    for frame in host.frames() {
        consumer.apply(&frame);
    }

    let root_node = consumer.node(root).expect("root node");
    assert_eq!(root_node.component, component_type::HSTACK);
    assert_eq!(root_node.children.len(), 2);
}
