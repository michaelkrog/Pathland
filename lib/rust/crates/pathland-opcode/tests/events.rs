//! Host → guest event-ring tests over the public API: backpressure (full ring),
//! FIFO ordering of multiple events, and drain-twice-is-empty.

use pathland_opcode::{init_memory, Event, Host, MemoryLayout, RingError};

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

    fn guest(&mut self) -> pathland_opcode::Guest<'_> {
        pathland_opcode::Guest::new(&mut self.mem, &self.layout)
    }

    fn host(&mut self) -> Host<'_> {
        Host::new(&mut self.mem, &self.layout)
    }
}

fn pointer_up(target: u32, x: f32, y: f32) -> Event {
    Event::PointerUp {
        target,
        x,
        y,
        secondary: false,
    }
}

#[test]
fn events_are_delivered_in_fifo_order() {
    let mut m = Memory::new(MemoryLayout::default());

    {
        let mut h = m.host();
        h.send_event(&pointer_up(1, 1.0, 2.0)).unwrap();
        h.send_event(&pointer_up(2, 3.0, 4.0)).unwrap();
        h.send_event(&pointer_up(3, 5.0, 6.0)).unwrap();
    }

    let mut g = m.guest();
    let events = g.drain_events();
    assert_eq!(
        events,
        vec![pointer_up(1, 1.0, 2.0), pointer_up(2, 3.0, 4.0), pointer_up(3, 5.0, 6.0)]
    );

    // Second drain is empty.
    assert!(g.drain_events().is_empty());
}

#[test]
fn event_ring_reports_full() {
    // Tiny ring: slot_count=2 -> usable capacity is slot_count-1 = 1 event.
    let layout = MemoryLayout {
        slot_count: 2,
        arena_bytes: 1 << 10,
    };
    let mut m = Memory::new(layout);

    {
        let mut h = m.host();
        assert!(h.send_event(&pointer_up(1, 0.0, 0.0)).is_ok());
        assert_eq!(
            h.send_event(&pointer_up(2, 0.0, 0.0)).unwrap_err(),
            RingError::Full
        );
    }

    // Draining frees a slot so the host can write again.
    {
        let mut g = m.guest();
        assert_eq!(g.drain_events().len(), 1);
    }
    {
        let mut h = m.host();
        assert!(h.send_event(&pointer_up(3, 0.0, 0.0)).is_ok());
    }
}

#[test]
fn events_and_tree_rings_are_independent() {
    let mut m = Memory::new(MemoryLayout::default());

    // Interleave a tree frame and events; each direction must not corrupt the other.
    {
        let mut g = m.guest();
        g.begin_frame();
        g.create_node(1, pathland_opcode::component_type::VSTACK).unwrap();
        g.end_frame();
    }
    {
        let mut h = m.host();
        h.send_event(&pointer_up(9, 1.0, 2.0)).unwrap();
    }

    {
        let mut g = m.guest();
        assert_eq!(g.drain_events(), vec![pointer_up(9, 1.0, 2.0)]);
    }

    {
        let mut h = m.host();
        let ops: Vec<_> = h.frames()[0].opcodes().collect();
        assert_eq!(ops.len(), 1);
        assert_eq!(ops[0].a(), 1);
    }
}
