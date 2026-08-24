//! The single application logic: author a view and project it through the
//! Pathland opcode protocol. Each entry point decodes the stream for its own
//! backend only.

use pathland_core_transport::FrameSource;
use pathland_waterui::Emitter;
use waterui::prelude::*;

/// The view authored by the application (the protocol's guest side).
pub fn source() -> impl View {
    vstack((
        text("Pathland round-trip"),
        text("This screen was serialized to 16-byte Pathland opcodes,"),
        text("transported, decoded, and rendered by the selected backend."),
        spacer(),
        hstack((button("Hello"), button("World"))),
    ))
}

/// Serialize `view` to Pathland opcodes, returning the emitter (which owns the
/// shared ring) and the root node id.
pub fn emit(view: impl View) -> (Emitter, u32) {
    let env = Environment::new();
    let mut emitter = Emitter::new();
    let root = emitter.emit(view, &env).expect("emit opcodes");
    (emitter, root)
}

/// Drain the emitter's frames into `sink`, which decodes them for its backend.
pub fn decode<S>(emitter: &Emitter, sink: &mut S)
where
    S: FnMut(&pathland_core::Frame<'_>),
{
    let transport = emitter.transport();
    let mut borrow = transport.borrow_mut();
    while let Ok(Some(batch)) = borrow.next_frame() {
        sink(batch.frame());
    }
}
