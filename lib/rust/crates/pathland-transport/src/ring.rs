//! Shared-memory ring transport (zero-copy, SPSC).
//!
//! The producer (opcode engine) and consumer (native driver) share one linear
//! memory buffer containing the ring + arena. The producer writes 16-byte
//! opcodes via `pathland_opcode::Guest`; the consumer reads completed frames via
//! `pathland_opcode::Host`. No copying, no batching, no serialization — this is
//! the high-performance local path.

use pathland_opcode::{init_memory, Guest, Host, MemoryLayout};

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
    fn send_input(&mut self, event: &pathland_opcode::Event) -> Result<(), TransportError> {
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
    pub fn drain_events(&mut self) -> Vec<pathland_opcode::Event> {
        let mut guest = self.producer();
        guest.drain_events()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use pathland_opcode::{category, property_id, tree};

    #[test]
    fn ring_round_trips_frames() {
        let mut ring = RingTransport::new();
        // Producer writes opcodes into the shared buffer via Guest.
        {
            let mut guest = ring.producer();
            guest.begin_frame();
            guest.create_node(1, 0x0002).unwrap();
            guest.create_node(2, 0x0003).unwrap();
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
            guest.create_node(1, 0x0002).unwrap();
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
        use pathland_opcode::Event;
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
}
