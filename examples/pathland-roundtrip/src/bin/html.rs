//! Pathland round-trip (HTML backend).
//!
//! The single application logic lives in [`pathland_roundtrip::roundtrip`];
//! this entry point renders the opcode stream as an HTML document and prints it
//! to the console. Run with `cargo run --bin html`.

use pathland_roundtrip::roundtrip;

fn main() {
    let (_native, html) = roundtrip::roundtrip(roundtrip::source());
    println!("{html}");
}
