//! Pathland round-trip (macOS backend).
//!
//! The single application logic lives in [`roundtrip`]; this entry point decodes
//! the opcode stream into WaterUI views and renders them through WaterUI's
//! platform backend (AppKit on macOS). Run with `water run --platform macos`.

pub mod roundtrip;

use pathland_waterui::Consumer;
use waterui::app::App;
use waterui::prelude::*;

fn main() -> impl View {
    let (emitter, root) = roundtrip::emit(roundtrip::source());

    let mut consumer = Consumer::new();
    roundtrip::decode(&emitter, &mut |frame| consumer.apply(frame));

    consumer.rebuild(root).expect("rebuild view tree")
}

pub fn app(env: Environment) -> App {
    App::new(main, env)
}

waterui_ffi::export!();
