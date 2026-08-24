//! The single application logic: author a view, project it through the
//! Pathland opcode protocol, and decode the stream for both renderers.
//!
//! Entry points select which backend consumes the result at run time:
//! the macOS app renders the native reconstruction, the `html` binary prints
//! the HTML document to the console.

use pathland_core_transport::FrameSource;
use pathland_render_html::HtmlRenderer;
use pathland_waterui::{Consumer, Emitter};
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

/// Serialize `view` to Pathland opcodes, then decode it with both renderers,
/// returning the reconstructed WaterUI view and the HTML document.
pub fn roundtrip(view: impl View) -> (waterui::AnyView, String) {
    let env = Environment::new();

    let mut emitter = Emitter::new();
    let root = emitter.emit(view, &env).expect("emit opcodes");

    let mut consumer = Consumer::new();
    let mut html = HtmlRenderer::new();
    {
        let transport = emitter.transport();
        let mut borrow = transport.borrow_mut();
        while let Ok(Some(batch)) = borrow.next_frame() {
            let frame = batch.frame();
            consumer.apply(frame);
            html.apply(frame);
        }
    }

    (
        consumer.rebuild(root).expect("rebuild view tree"),
        html.render(root),
    )
}
