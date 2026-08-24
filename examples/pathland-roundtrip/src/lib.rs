use waterui::AnyView;
use waterui::app::App;
use waterui::prelude::*;
use waterui::reactive::binding;
use waterui::widget::condition::when;

use pathland_core_transport::FrameSource;
use pathland_render_html::HtmlRenderer;
use pathland_waterui::{Consumer, Emitter};

/// The demo: author a view in WaterUI, project it through the Pathland opcode
/// protocol, and render the result through one of two backends:
///
/// - **native** — the opcodes are decoded back into WaterUI views and rendered
///   by the platform backend (AppKit on macOS).
/// - **html** — the same opcodes are rendered as a standalone HTML document.
///
/// Toggle between them to prove both backends consume the identical stream.
fn main() -> impl View {
    let html_mode = binding(false);

    vstack((
        text("Pathland round-trip"),
        Toggle::new(&html_mode).label("HTML renderer"),
        when(html_mode.clone(), html_pane).otherwise(native_pane),
    ))
}

/// The view authored by the application (the protocol's guest side).
fn source() -> impl View {
    vstack((
        text("This screen was serialized to 16-byte Pathland opcodes,"),
        text("transported, decoded, and rendered by the selected backend."),
        spacer(),
        hstack((button("Hello"), button("World"))),
    ))
}

/// Native backend: decode opcodes back into WaterUI views.
fn native_pane() -> impl View {
    roundtrip(source()).0
}

/// HTML backend: render the same opcodes as an HTML document.
fn html_pane() -> impl View {
    let html = roundtrip(source()).1;
    scroll(text(html))
}

/// Serialize `view` to Pathland opcodes, then decode it with both renderers.
fn roundtrip(view: impl View) -> (AnyView, String) {
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

pub fn app(env: Environment) -> App {
    App::new(main, env)
}

waterui_ffi::export!();
