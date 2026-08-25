//! Pathland native demo.
//!
//! A WaterUI app rendered directly through the platform backend (AppKit on
//! macOS). No Pathland — this is the native twin of the web demo in
//! `examples/pathland-web`. Run with `water run --platform macos`.

use waterui::app::App;
use waterui::prelude::*;

fn main() -> impl View {
    vstack((
        text("Pathland native"),
        text("Rendered directly by WaterUI's native backend."),
        spacer(),
        hstack((button("Hello"), button("World"))),
    ))
}

pub fn app(env: Environment) -> App {
    App::new(main, env)
}

waterui_ffi::export!();
