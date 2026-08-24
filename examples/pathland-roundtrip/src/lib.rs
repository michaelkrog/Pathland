//! Pathland round-trip (macOS backend).
//!
//! The single application logic lives in [`roundtrip`]; this entry point renders
//! the native reconstruction through WaterUI's platform backend (AppKit on
//! macOS). Run with `water run --platform macos`.

pub mod roundtrip;

use waterui::app::App;
use waterui::prelude::*;

fn main() -> impl View {
    roundtrip::roundtrip(roundtrip::source()).0
}

pub fn app(env: Environment) -> App {
    App::new(main, env)
}

waterui_ffi::export!();
