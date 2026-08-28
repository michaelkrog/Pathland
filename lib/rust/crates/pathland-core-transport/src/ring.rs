//! Shared-memory ring transport (zero-copy, SPSC).
//!
//! The producer (opcode engine) and consumer (native driver) share one linear
//! memory buffer containing the ring + arena. The producer writes 16-byte
//! opcodes via `pathland_core::Guest`; the consumer reads completed frames via
//! `pathland_core::Host`. No copying, no batching, no serialization — this is
//! the high-performance local path.

use pathland_core::{init_memory, Guest, Host, MemoryLayout};

use crate::traits::{DriverTransport, FrameSource, OpcodeBatch, TransportError};

/// A zero-copy SPSC shared-memory ring transport.
///
/// Owns the linear-memory buffer (header + ring + arena). Producers and
/// consumers are granted short-lived `Guest`/`Host` views over the same buffer
/// via the borrowed methods, so opcodes flow in place with no copies.
#[derive(Debug)]
pub struct RingTransport {
    /// Shared linear memory (header | ring | arena).
    mem: Vec<u8>,
    /// Ring/arena geometry.
    layout: MemoryLayout,
}

impl RingTransport {
    /// Create a ring transport with a default layout and a zeroed header.
    pub fn new() -> Self {
        let layout = MemoryLayout::default();
        let mut mem = vec![0u8; layout.total_bytes()];
        init_memory(&mut mem, &layout);
        Self { mem, layout }
    }

    /// Create a ring transport over a caller-provided buffer/layout.
    pub fn with_buffer(mem: Vec<u8>, layout: MemoryLayout) -> Self {
        Self { mem, layout }
    }

    /// The memory layout (region geometry).
    pub fn layout(&self) -> &MemoryLayout {
        &self.layout
    }

    /// Create a producer view over the shared buffer (writes opcodes + arena).
    ///
    /// Drop the returned `Guest` before calling `next_frame`; producer and
    /// consumer must not overlap borrows.
    pub fn producer(&mut self) -> Guest<'_> {
        Guest::new(&mut self.mem, &self.layout)
    }

    /// Peak at the raw underlying buffer (for embedding/custom transports).
    pub fn buffer(&self) -> &[u8] {
        &self.mem
    }
}

impl Default for RingTransport {
    fn default() -> Self {
        Self::new()
    }
}

impl FrameSource for RingTransport {
    fn next_frame(&mut self) -> Result<Option<OpcodeBatch<'_>>, TransportError> {
        let mut host = Host::new(&mut self.mem, &self.layout);
        let mut frames = host.frames();
        match frames.pop() {
            Some(frame) => Ok(Some(OpcodeBatch::new(
                frame,
                crate::direction::GUEST_TO_HOST,
            ))),
            None => Ok(None),
        }
    }
}

impl DriverTransport for RingTransport {
    fn send_input(&mut self, event: &pathland_core::Event) -> Result<(), TransportError> {
        // The host writes the raw input as an EVENT-category opcode into the
        // host → guest event ring; the guest drains it via `drain_events`.
        let mut host = Host::new(&mut self.mem, &self.layout);
        host.send_event(event).map_err(|_| {
            TransportError::Protocol(crate::ProtocolError::BadInput)
        })
    }
}

impl RingTransport {
    /// Drain raw-input events written by the host into the host → guest event
    /// ring, decoding each `EVENT` opcode (guest side).
    pub fn drain_events(&mut self) -> Vec<pathland_core::Event> {
        let mut guest = self.producer();
        guest.drain_events()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use pathland_core::{category, property_id, tree};

    #[test]
    fn ring_round_trips_frames() {
        let mut ring = RingTransport::new();
        // Producer writes opcodes into the shared buffer via Guest.
        {
            let mut guest = ring.producer();
            guest.begin_frame();
            guest.create_node(1, 0x0010).unwrap();
            guest.create_node(2, 0x0001).unwrap();
            guest.insert_child(1, 2, 0).unwrap();
            guest
                .set_property(2, property_id::SPACING, 0x04, 4.0f32.to_bits())
                .unwrap();
            guest.end_frame();
        }
        // Consumer reads the frame back from the same shared buffer.
        let batch = ring.next_frame().unwrap().expect("a frame");
        let ops: Vec<_> = batch.frame().opcodes().collect();
        assert_eq!(ops.len(), 4);
        assert_eq!(ops[0].category(), category::TREE);
        assert!(ops.iter().any(|o| o.command() == tree::CREATE_NODE));
    }

    #[test]
    fn ring_empty_when_no_frame() {
        let mut ring = RingTransport::new();
        assert!(ring.next_frame().unwrap().is_none());
    }

    #[test]
    fn next_frame_returns_none_after_drain() {
        let mut ring = RingTransport::new();
        {
            let mut guest = ring.producer();
            guest.begin_frame();
            guest.create_node(1, 0x0010).unwrap();
            guest.end_frame();
        }
        // First drain yields the frame.
        assert!(ring.next_frame().unwrap().is_some());
        // Subsequent drains yield None (no empty-frame loop).
        assert!(ring.next_frame().unwrap().is_none());
        assert!(ring.next_frame().unwrap().is_none());
    }

    #[test]
    fn ring_carries_events_host_to_guest() {
        use pathland_core::Event;
        let mut ring = RingTransport::new();
        // Host (renderer) reports a click.
        DriverTransport::send_input(
            &mut ring,
            &Event::PointerUp {
                target: 4,
                x: 1.0,
                y: 2.0,
                secondary: false,
            },
        )
        .unwrap();
        // Guest (app) drains it as a typed event.
        assert_eq!(
            ring.drain_events(),
            vec![Event::PointerUp {
                target: 4,
                x: 1.0,
                y: 2.0,
                secondary: false,
            }]
        );
        assert!(ring.drain_events().is_empty());
    }

    #[test]
    fn next_frame_is_zero_copy() {
        // The ring is a single shared linear-memory buffer. Reading a frame
        // must borrow that buffer in place — never copy the opcode stream.
        // Prove two things:
        //  1. Reading N opcodes allocates O(1) bookkeeping, not O(N) storage
        //     (a copy of the opcode stream would allocate per-opcode).
        //  2. The arena string decoded from the frame lives inside the shared
        //     buffer (pointer identity), i.e. it is read in place.

        use std::alloc::{GlobalAlloc, Layout as AllocLayout};
        use std::cell::Cell;
        use std::thread_local;

        thread_local! {
            static COUNT: Cell<usize> = const { Cell::new(0) };
        }
        struct Counting;
        unsafe impl GlobalAlloc for Counting {
            unsafe fn alloc(&self, l: AllocLayout) -> *mut u8 {
                COUNT.with(|c| c.set(c.get() + 1));
                // SAFETY: forward to the system allocator.
                unsafe { std::alloc::System.alloc(l) }
            }
            unsafe fn dealloc(&self, p: *mut u8, l: AllocLayout) {
                // SAFETY: forward to the system allocator.
                unsafe { std::alloc::System.dealloc(p, l) }
            }
        }
        #[global_allocator]
        static A: Counting = Counting;

        const OPCODES: usize = 1000;

        let mut ring = RingTransport::new();
        let buf_base = ring.buffer().as_ptr() as usize;
        let buf_end = buf_base + ring.buffer().len();

        // Producer writes opcodes + a string into the shared buffer (no copies).
        let arena_ref = {
            let mut guest = ring.producer();
            guest.begin_frame();
            for i in 0..OPCODES {
                guest.create_node(i as u32 + 1, 0x0001).unwrap();
            }
            let r = guest.set_text(1, "zero-copy proof").unwrap();
            guest.end_frame();
            r
        };

        // Consumer reads the frame. Count allocations: the opcode stream is
        // borrowed, so allocations must be O(1), independent of the opcode count.
        COUNT.with(|c| c.set(0));
        let batch = ring.next_frame().unwrap().expect("a frame");
        let frame = batch.frame();

        let decoded: usize = frame.opcodes().count();
        let arena = frame.arena_str(arena_ref).expect("arena string");

        let allocs = COUNT.with(|c| c.get());

        assert_eq!(decoded, OPCODES + 1, "create_node + set_text");
        assert_eq!(arena, "zero-copy proof");

        // The arena string is read in place from the shared buffer.
        let str_ptr = arena.as_ptr() as usize;
        assert!(
            str_ptr >= buf_base && str_ptr < buf_end,
            "arena string must be borrowed from the shared ring (ptr {str_ptr:#x} outside {buf_base:#x}..{buf_end:#x})"
        );

        // No per-opcode copying: a handful of O(1) bookkeeping allocations is
        // fine; anything O(opcodes) would mean the opcode stream was copied.
        assert!(
            allocs < OPCODES,
            "reading {OPCODES} opcodes must not copy them (allocations: {allocs})"
        );
    }
}
