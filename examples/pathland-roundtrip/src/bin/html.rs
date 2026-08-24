//! Pathland round-trip (HTML backend).
//!
//! The single application logic lives in [`pathland_roundtrip::roundtrip`];
//! this entry point decodes the opcode stream into an HTML document and prints
//! it to the console. Run with `cargo run --bin html`.

use pathland_render_html::HtmlRenderer;
use pathland_roundtrip::roundtrip;

fn main() {
    let (emitter, root) = roundtrip::emit(roundtrip::source());

    let mut renderer = HtmlRenderer::new();
    roundtrip::decode(&emitter, &mut |frame| renderer.apply(frame));

    println!("{}", renderer.render(root));
}
