//! Transport abstraction: how opcode batches move from producer to consumer.
//!
//! The UI runtime produces renderer-neutral opcodes and knows nothing about the
//! transport. This module defines the boundary between:
//!
//! - the **producer** (opcode engine) that emits opcodes, and
//! - the **consumer** (driver) that reads them.
//!
//! Local transports (shared-memory ring) may be zero-copy; remote transports
//! (WebSocket/IPC) copy and serialize. Both conform to the same traits.
//!
//! The two ends are deliberately separate because a transport is often split
//! across a process/IPC boundary, with different backpressure and blocking
//! semantics on each side.

use pathland_opcode::Frame;

/// A single in-memory transport unit: one frame of opcodes + arena plus
/// transport metadata. Distinct from the raw opcode stream and from the
/// wire-format batch.
pub struct OpcodeBatch<'a> {
    frame: Frame<'a>,
    /// Transport direction bitmask (see [`crate::direction`]).
    direction: u16,
}

impl<'a> OpcodeBatch<'a> {
    /// Wrap a frame as a transport batch (guest → host by default).
    pub fn new(frame: Frame<'a>, direction: u16) -> Self {
        Self { frame, direction }
    }

    /// The frame carried by this batch.
    pub fn frame(&self) -> &Frame<'a> {
        &self.frame
    }

    /// Transport direction bitmask.
    pub fn direction(&self) -> u16 {
        self.direction
    }
}

/// Errors produced by a transport while sending or receiving.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransportError {
    /// The consumer has not drained; the producer should retain and retry.
    Backpressure,
    /// The transport is closed/terminated.
    Closed,
    /// The peer violated the protocol.
    Protocol(ProtocolError),
}

/// Sub-errors for protocol violations.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProtocolError {
    /// The remote sent a version this side does not support.
    BadVersion,
    /// The payload is malformed (bad magic, truncated, bad length).
    Malformed,
    /// A raw input could not be interpreted.
    BadInput,
}

/// Handles raw-input events arriving from the host (renderer → engine).
///
/// The driver resolves a raw input to a node id (via hit-testing) and dispatches
/// it here; the transport's guest side forwards it to the guest engine.
pub trait InputSink {
    /// Deliver a raw input (host → guest).
    fn dispatch(&mut self, event: &pathland_opcode::Event);
}

/// The consumer side of a transport: the driver reads frames here.
///
/// A transport may be blocking or non-blocking; `next_frame` reflects that.
/// The returned `Frame` borrows the transport's backing memory (zero-copy when
/// possible); consume it before the next call.
pub trait FrameSource {
    /// Read the next available frame, or `None` if none is ready.
    ///
    /// Blocking vs non-blocking semantics are transport-specific (documented
    /// per implementation).
    fn next_frame(&mut self) -> Result<Option<OpcodeBatch<'_>>, TransportError>;
}

/// A consumer-side transport that can also send raw inputs back to the guest.
pub trait DriverTransport: FrameSource {
    /// Send a raw input from the host to the guest over this transport.
    fn send_input(&mut self, event: &pathland_opcode::Event) -> Result<(), TransportError>;
}
