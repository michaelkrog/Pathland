//! # pathland-waterui
//!
//! A Pathland backend for WaterUI: the producer walks a WaterUI view tree and
//! emits the declarative structure as Pathland's 16-byte opcodes; the consumer
//! decodes those opcodes back into a retained node description that can be
//! reconstructed as WaterUI views.
//!
//! This crate is the "bridge": WaterUI owns change detection and native
//! rendering (via its own backends), while Pathland supplies the wire protocol
//! and transport. Neither side is aware of the other's private machinery.

pub mod consumer;
pub mod producer;

pub use consumer::Consumer;
pub use producer::Emitter;
