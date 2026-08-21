# Pathland Rust Workspace

The Rust core of Pathland: the **opcode engine** that emits the declarative
view structure as a fixed 16-byte opcode ring buffer into shared linear memory,
consumed by host renderers. Runs natively on desktop (C ABI + GTK renderer);
WASM/WIT is the browser/remote projection only.

```
crates/
├── pathland-opcode/   # 16-byte opcode, ring buffer, bump arena, linear-memory layout (no_std)
├── pathland-view/     # SwiftUI-style view DSL: VStack/HStack/Text/Button + decoupled
│                      #   chainable modifiers (spacing/padding/fontSize/color/background) (no_std)
├── pathland-engine/   # retained view tree -> declarative TREE/STYLE opcodes,
│                      #   diff-based reactive emission (zero-alloc steady state)
├── pathland-host/     # host reader: ring -> native-element description (std layer)
├── pathland-transport/# opcode transport: shared-memory ring + network batch encode/decode
│                      #   + batching policy + transport abstraction (RingTransport/FrameSource)
├── pathland-guest/    # WASM guest component: retained tree + engine + emit/take-batch (browser)
├── pathland-wit-host/ # WIT host bindings + DSL bridge (wasmtime embed, remote hosts)
├── pathland-native/   # native C-ABI shim + NativeHost: flat world over a zero-copy shared ring
├── pathland-gtk/      # GTK4 RENDERER (rlib + cdylib): opcode frames -> native GTK widgets
│                      #   (incremental); the only crate that touches GTK/glib/pango
├── pathland-codegen/  # DSL code generator: parses lib/ui/components.yaml, asserts ids,
│                      #   emits the checked-in Java DSL
└── pathland-gtk-demo/ # GTK4 desktop demo: authors the DSL, renders through pathland-gtk
                       #   (uses NO GTK APIs directly)

# Cross-language demo
../java/pathland-demo/ # Java (Maven): SwiftUI-like DSL + JNA over pathland-native,
                       #   rendered through pathland-gtk (uses NO Swing / NO GTK APIs)
```

## Specification

- [`spec/OPCODE.md`](../../spec/OPCODE.md) — the 16-byte opcode protocol
- [`spec/CONFORMANCE.md`](../../spec/CONFORMANCE.md) — golden byte vectors
- [`wit/pathland.wit`](../../wit/pathland.wit) — the WIT component world

## Run tests

```bash
PATH="$HOME/.cargo/bin:$PATH" cargo test
```

## Run the GTK desktop demo (native, zero-copy shared ring)

```bash
PATH="$HOME/.cargo/bin:$PATH" cargo run -p pathland-gtk-demo
```

Requires GTK4 (`brew install gtk4` on macOS).

## Run the Java demo (cross-language, JNA over the native C-ABI shim + GTK renderer)

```bash
PATH="$HOME/.cargo/bin:$PATH" cargo build -p pathland-native -p pathland-gtk
cd ../java/pathland-demo && mvn -q -Dpathland.rust.target=<lib/rust/target/debug> compile exec:java
```

On macOS, GTK must run on the main thread: prefix the mvn command with
`MAVEN_OPTS="-XstartOnFirstThread"`.

The Java app uses a SwiftUI-like DSL, drives the Rust engine via the flat
`pathland_native_*` C ABI (no per-component wrappers), and renders through the
shared `pathland-gtk` renderer (in-process via JNA). It uses **no Swing and no
GTK APIs directly** — button clicks round-trip as `EVENT` opcodes through the
shared ring. Verify headlessly with `-Dexec.mainClass=demo.DemoHeadless`.


## Build for wasm32 (browser projection only)

```bash
RUSTC=~/.rustup/toolchains/stable-aarch64-apple-darwin/bin/rustc \
  cargo build --target wasm32-unknown-unknown
```

> The Homebrew `cargo` on PATH resolves a rustc without the wasm std. Use the
> rustup toolchain's rustc via `RUSTC=...` (or `rustup run stable cargo`).

## Engine example

The engine emits declarative structure (no rects). A signal changes a property;
the next `emit` writes only the delta opcodes.

```rust
use pathland_engine::Engine;
use pathland_opcode::{init_memory, Guest, MemoryLayout};
use pathland_view::{assign_ids, text, vstack, View, ViewExt};

let layout = MemoryLayout::default();
let mut mem = vec![0u8; layout.total_bytes()];
init_memory(&mut mem, &layout);

let mut guest = Guest::new(&mut mem, &layout);
let mut engine = Engine::new();

let mut root = vstack![text("Hello")]
    .spacing(4.0)
    .padding(8.0)
    .build();
assign_ids(&mut root, &mut 1);

guest.begin_frame();
engine.emit(&root, &mut guest).unwrap(); // full structure
guest.end_frame();

root.properties.insert(pathland_opcode::property_id::SPACING, 12.0f32.to_bits());

guest.begin_frame();
engine.emit(&root, &mut guest).unwrap(); // exactly one SET_PROPERTY
guest.end_frame();
```

Emission in the steady state allocates nothing; only changed nodes produce
opcodes, so an unchanged tree emits zero opcodes. Native renderers map the
structure onto their native elements (GTK4 widgets, DOM elements).

## Network transport example

Frames emitted into the ring can be serialized into network batches and flushed
on a time/size policy (`BatchEncoder` / `Batcher`); a `BatchDecoder` rebuilds a
`Frame`-compatible view so the same `RenderTree::apply_frame` consumes batches
and shared-memory frames identically. See `spec/OPCODE.md#transport`.
