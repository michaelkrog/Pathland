# Pathland Rust Workspace

The Rust core of Pathland: a **WASM guest engine** that emits the declarative
view structure as a fixed 16-byte opcode ring buffer into shared linear memory,
consumed by host renderers.

```
crates/
├── pathland-opcode/   # 16-byte opcode, ring buffer, bump arena, linear-memory layout (no_std)
├── pathland-view/     # SwiftUI-style view DSL: VStack/HStack/Text + decoupled
│                      #   chainable modifiers (spacing/padding/fontSize/color/background) (no_std)
├── pathland-engine/   # retained view tree -> declarative TREE/STYLE opcodes,
│                      #   diff-based reactive emission (zero-alloc steady state)
└── pathland-host/     # host reader: ring -> native-element description (std layer)
```

## Specification

- [`spec/OPCODE.md`](../../spec/OPCODE.md) — the 16-byte opcode protocol
- [`spec/CONFORMANCE.md`](../../spec/CONFORMANCE.md) — golden byte vectors

## Run tests

```bash
cargo test
```

## Build for wasm32

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
