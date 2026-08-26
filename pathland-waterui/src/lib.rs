//! # pathland-waterui
//!
//! A Pathland backend for WaterUI: the producer walks a WaterUI view tree and
//! emits the declarative structure as Pathland's 16-byte opcodes. The runtime
//! surface of this crate is the producer ([`Emitter`]).
//!
//! The reverse direction — decoding opcodes back into a retained node
//! description that can be reconstructed as WaterUI views — exists only for
//! the round-trip tests; it lives in `tests/support/` and is **not** part of
//! the library's public API.
//!
//! This crate is the "bridge": WaterUI owns change detection and native
//! rendering (via its own backends), while Pathland supplies the wire protocol
//! and transport. Neither side is aware of the other's private machinery.

pub mod producer;

pub use producer::Emitter;
