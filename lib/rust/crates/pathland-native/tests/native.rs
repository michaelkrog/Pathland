//! End-to-end test of the native host: flat builder → emit → zero-copy ring →
//! render-tree decode.

use pathland_host::RenderTree;
use pathland_native::{component_from_id, NativeHost};
use pathland_opcode::{property_id, SharedHeader};
use pathland_transport::FrameSource;

#[test]
fn flat_builder_emit_then_render_tree() {
    let mut host = NativeHost::new();

    // Build: vstack(1) + [ text(2, "Hello"), button(3) ]
    host.create_node(1, pathland_view::Component::VStack);
    host.create_node(2, pathland_view::Component::Text { text: "".into() });
    host.create_node(3, pathland_view::Component::Button { label: "".into() });
    host.set_text(2, "Hello");
    host.set_property_f32(1, property_id::SPACING, 8.0);
    host.insert_child(1, 2, u32::MAX);
    host.insert_child(1, 3, u32::MAX);

    assert!(host.emit(), "a frame must be written");

    // The header shows a completed frame (frameCount incremented).
    {
        let mem = host.ring_buffer();
        let header = SharedHeader::new(mem);
        assert!(header.frame_count() >= 1);
    }

    // Drain the ring and decode the emitted frame into a RenderTree.
    let mut render = RenderTree::default();
    let mut ring = host.take_ring();
    if let Some(batch) = ring.next_frame().unwrap() {
        render.apply_frame(batch.frame());
    }
    assert_eq!(render.nodes.len(), 3);
    assert_eq!(render.node(2).unwrap().text.as_deref(), Some("Hello"));
    let root = render.node(1).unwrap();
    assert_eq!(root.component_type, pathland_opcode::component_type::VSTACK);
    assert_eq!(root.children, vec![2, 3]);
}

#[test]
fn component_from_id_maps_flat_surface() {
    assert_eq!(
        component_from_id(2),
        Some(pathland_view::Component::VStack)
    );
    assert_eq!(component_from_id(3), Some(pathland_view::Component::Text { text: "".into() }));
    assert!(component_from_id(999).is_none());
}
