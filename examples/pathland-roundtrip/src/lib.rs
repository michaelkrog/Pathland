use waterui::AnyView;
use waterui::app::App;
use waterui::prelude::*;

use pathland_core_transport::FrameSource;
use pathland_waterui::{Consumer, Emitter};

/// The demo: author a view in WaterUI, project it through the Pathland opcode
/// protocol (emit → transport → decode → rebuild), and render the reconstruction
/// via WaterUI's native backend.
fn main() -> impl View {
    let source = vstack((
        text("Pathland round-trip"),
        text("This screen was serialized to 16-byte Pathland opcodes,"),
        text("transported, decoded, and reconstructed as a view tree."),
        spacer(),
        hstack((button("Hello"), button("World"))),
    )).padding_with(EdgeInsets::all(16.0));

    roundtrip(source)
}

/// Serialize `view` to Pathland opcodes and rebuild it back into WaterUI views.
fn roundtrip(view: impl View) -> AnyView {
    let env = Environment::new();

    let mut emitter = Emitter::new();
    let root = emitter.emit(view, &env).expect("emit opcodes");

    let mut consumer = Consumer::new();
    {
        let transport = emitter.transport();
        let mut borrow = transport.borrow_mut();
        while let Ok(Some(batch)) = borrow.next_frame() {
            consumer.apply(batch.frame());
        }
    }

    consumer.rebuild(root).expect("rebuild view tree")
}

pub fn app(env: Environment) -> App {
    App::new(main, env)
}

waterui_ffi::export!();
