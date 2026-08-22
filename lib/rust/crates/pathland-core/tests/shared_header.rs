//! `SharedHeader` is the zero-copy read surface a foreign driver uses to read
//! the ring in place, without a `Host` handle. These tests assert its accessors
//! report the same values the header block actually holds.

use pathland_core::{
    component_type, init_memory, SharedHeader, Guest, Host, MemoryLayout,
};

#[test]
fn shared_header_reflects_ring_activity() {
    let layout = MemoryLayout::default();
    let mut mem = vec![0u8; layout.total_bytes()];
    init_memory(&mut mem, &layout);

    {
        let mut g = Guest::new(&mut mem, &layout);
        g.begin_frame();
        g.create_node(1, component_type::VSTACK).unwrap();
        g.end_frame();
    }

    let header = SharedHeader::new(&mem);
    assert_eq!(header.frame_count(), 1);
    assert_eq!(header.slot_count(), layout.slot_count as u32);
    assert_eq!(header.ring_offset(), layout.ring_offset());
    assert_eq!(header.ring_bytes(), layout.ring_bytes());
    assert_eq!(header.arena_offset(), layout.arena_offset());
    // Guest wrote 1 opcode: writeCursor advanced, readCursor untouched.
    assert_eq!(header.write_cursor(), 1);
    assert_eq!(header.read_cursor(), 0);
    // No arena data allocated yet.
    assert_eq!(header.arena_cursor(), 0);
}

#[test]
fn shared_header_tracks_arena_and_consumer() {
    let layout = MemoryLayout::default();
    let mut mem = vec![0u8; layout.total_bytes()];
    init_memory(&mut mem, &layout);

    let arena_ref = {
        let mut g = Guest::new(&mut mem, &layout);
        g.begin_frame();
        g.create_node(1, component_type::TEXT).unwrap();
        let ref_ = g.set_text(1, "abc").unwrap();
        g.end_frame();
        ref_
    };

    {
        let mut h = Host::new(&mut mem, &layout);
        assert_eq!(h.frames().len(), 1);
    }

    let header = SharedHeader::new(&mem);
    // Arena entry for "abc": [len u32][3 bytes] = 7 bytes consumed.
    assert_eq!(header.arena_cursor(), arena_ref + 4 + 3);
    // Consumer drained the single opcode: readCursor caught up to writeCursor.
    assert_eq!(header.read_cursor(), header.write_cursor());
}

#[test]
fn shared_header_on_fresh_memory_is_zeroed() {
    let layout = MemoryLayout::default();
    let mut mem = vec![0u8; layout.total_bytes()];
    init_memory(&mut mem, &layout);

    let header = SharedHeader::new(&mem);
    assert_eq!(header.frame_count(), 0);
    assert_eq!(header.read_cursor(), 0);
    assert_eq!(header.write_cursor(), 0);
    assert_eq!(header.arena_cursor(), 0);
}
