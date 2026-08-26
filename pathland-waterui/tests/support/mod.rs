//! Test-only support: shared helpers for the round-trip tests.
//!
//! This module is NOT part of the library's runtime API — the runtime backend
//! is the producer (`Emitter`). The [`consumer`] decoder exists solely so the
//! tests can apply frames to a retained description and assert on it.

pub mod consumer;