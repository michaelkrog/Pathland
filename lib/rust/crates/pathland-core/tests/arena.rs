//! Arena behaviour over the public API: `Guest::alloc`/`alloc_str` write
//! self-describing entries that `Frame::arena_get`/`arena_str` read back, plus
//! the error paths (`OutOfSpace`, `InvalidOffset`, invalid UTF-8).

use pathland_core::{init_memory, ArenaError, Guest, Host, MemoryLayout};

struct Memory {
    mem: Vec<u8>,
    layout: MemoryLayout,
}

impl Memory {
    fn new(layout: MemoryLayout) -> Self {
        let mut mem = vec![0u8; layout.total_bytes()];
        init_memory(&mut mem, &layout);
        Self { mem, layout }
    }

    fn guest(&mut self) -> Guest<'_> {
        Guest::new(&mut self.mem, &self.layout)
    }

    fn host(&mut self) -> Host<'_> {
        Host::new(&mut self.mem, &self.layout)
    }
}

#[test]
fn alloc_and_alloc_str_round_trip() {
    let mut m = Memory::new(MemoryLayout::default());

    let (o1, o2, o3) = {
        let mut g = m.guest();
        g.begin_frame();
        // A create_node publishes the frame so the host can read the arena.
        g.create_node(1, pathland_core::component_type::TEXT).unwrap();
        let o1 = g.alloc(&[1, 2, 3, 4]).unwrap();
        let o2 = g.alloc_str("hello").unwrap();
        let o3 = g.alloc(&[]).unwrap();
        g.end_frame();
        (o1, o2, o3)
    };

    let mut h = m.host();
    let frame = &h.frames()[0];
    assert_eq!(frame.arena_get(o1).unwrap(), &[1, 2, 3, 4]);
    assert_eq!(frame.arena_str(o2).unwrap(), "hello");
    // Empty allocation: a 4-byte (length 0) entry.
    assert_eq!(frame.arena_get(o3).unwrap(), &[]);
}

#[test]
fn out_of_space_is_reported_via_guest_alloc() {
    let layout = MemoryLayout {
        slot_count: 64,
        arena_bytes: 8,
        event_arena_bytes: 8,
    };
    let mut m = Memory::new(layout);

    let mut g = m.guest();
    // 8 bytes of arena fits exactly one 4-byte-length + 4-byte payload.
    assert!(g.alloc(&[1, 2, 3, 4]).is_ok());
    // Next allocation of any size must fail.
    assert_eq!(g.alloc(&[5]).unwrap_err(), ArenaError::OutOfSpace);
}

#[test]
fn set_text_maps_arena_full_to_ring_full() {
    let layout = MemoryLayout {
        slot_count: 64,
        arena_bytes: 8,
        event_arena_bytes: 8,
    };
    let mut m = Memory::new(layout);

    let mut g = m.guest();
    g.create_node(1, pathland_core::component_type::TEXT).unwrap();
    // Arena only fits ~4 bytes of payload; a larger string overflows.
    let err = g.set_text(1, "this string is far too long for an 8-byte arena").unwrap_err();
    assert_eq!(err, pathland_core::RingError::Full);
}

#[test]
fn invalid_offset_is_reported() {
    let mut m = Memory::new(MemoryLayout::default());
    let arena_bytes = m.layout.arena_bytes;
    let o = {
        let mut g = m.guest();
        g.begin_frame();
        g.create_node(1, pathland_core::component_type::TEXT).unwrap();
        let o = g.alloc_str("hi").unwrap();
        g.end_frame();
        o
    };

    let mut h = m.host();
    let frame = &h.frames()[0];

    // Offset far past the arena.
    let bad: u32 = (arena_bytes + 10) as u32;
    assert_eq!(frame.arena_get(bad).unwrap_err(), ArenaError::InvalidOffset);

    // Offset into the middle of a live entry is still valid ("hi").
    assert_eq!(frame.arena_str(o).unwrap(), "hi");
}

#[test]
fn invalid_utf8_in_arena_is_rejected_by_arena_str() {
    let mut m = Memory::new(MemoryLayout::default());
    let o = {
        let mut g = m.guest();
        g.begin_frame();
        g.create_node(1, pathland_core::component_type::TEXT).unwrap();
        // 0xFF is not valid UTF-8.
        let o = g.alloc(&[0xFF, 0xFE, 0xFD]).unwrap();
        g.end_frame();
        o
    };

    let mut h = m.host();
    let frame = &h.frames()[0];
    // Bytes are retrievable, but interpreting them as a string fails.
    assert_eq!(frame.arena_get(o).unwrap(), &[0xFF, 0xFE, 0xFD]);
    assert_eq!(frame.arena_str(o).unwrap_err(), ArenaError::InvalidOffset);
}
