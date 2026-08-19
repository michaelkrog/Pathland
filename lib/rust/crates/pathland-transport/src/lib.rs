//! # pathland-transport
//!
//! How Pathland opcodes are transported from the guest engine to host
//! renderers. There are two peer backends:
//!
//! - **Shared memory** (desktop/native): the ring buffer + arena in
//!   `pathland-opcode` (`Guest`/`Host`). Zero-copy. This crate treats it as
//!   the local transport — no duplication.
//! - **Network batch** (SSR → browser): opcodes + arena data serialized into
//!   **batches**, flushed on a **time interval** or a **network-frame size**
//!   (whichever comes first).
//!
//! `pathland_opcode::Frame` is the **transport seam**: `pathland-host`'s
//! `RenderTree::apply_frame` consumes frames regardless of origin. `BatchDecoder`
//! produces `Frame` views over decoded batches, so a network batch feeds the
//! renderer exactly like a shared-memory frame.
//!
//! ## Batch wire format
//!
//! ```text
//! magic "PLPL" (u32 LE) | version (u16) | flags (u16) | frameCount (u32)
//! | opcodeCount (u32) | opcodes (16 B × opcodeCount) | arenaDeltaLen (u32)
//! | arena delta bytes
//! ```
//!
//! The arena is append-only (bump); batches carry only the bytes appended since
//! the previous batch. The decoder appends them to a mirrored arena, so absolute
//! `arenaRef` offsets stay valid — exactly as in shared memory.
//!
//! ## Example (producer)
//!
//! ```no_run
//! use pathland_transport::{Batcher, BatchPolicy, BatchEncoder};
//! use std::time::Duration;
//!
//! let policy = BatchPolicy::new(Duration::from_millis(4), 1400);
//! let mut batcher = Batcher::new(policy);
//! let mut encoder = BatchEncoder::new();
//!
//! // batcher.push_frame(&frame) accumulates opcodes + arena delta;
//! // batcher.flush() -> Option<Vec<u8>> produces the serialized batch.
//! ```

#![forbid(unsafe_op_in_unsafe_fn)]

extern crate alloc;

mod batch;
mod batching;
mod conformance;
mod net;
mod ring;
mod traits;

pub use batch::{encode_batch, Batch, BatchDecoder, BatchEncoder};
pub use batching::{Batcher, BatchPolicy};
pub use net::NetBatchEncoder;
pub use ring::RingTransport;
pub use traits::{
    DriverTransport, FrameSource, InputSink, OpcodeBatch, ProtocolError, TransportError,
};

/// Wire magic for network batches (`PLPL`).
pub const BATCH_MAGIC: u32 = 0x504C_504C;
/// Wire version for the batch format.
pub const BATCH_VERSION: u16 = 1;

/// Direction of a batch. Events are not yet implemented; this bit is reserved.
pub mod direction {
    /// The batch carries guest → host tree/style opcodes.
    pub const GUEST_TO_HOST: u16 = 0x0000;
    /// The batch carries host → guest raw-input events (reserved).
    pub const HOST_TO_GUEST: u16 = 0x0001;
}
