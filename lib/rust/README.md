# Pathland Rust Workspace

The Rust core of Pathland: a **WASM guest engine** that emits a fixed 16-byte
opcode ring buffer into shared linear memory, consumed by host renderers.

```
crates/
├── pathland-opcode/   # 16-byte opcode, ring buffer, bump arena, linear-memory layout (no_std)
├── pathland-layout/   # VStack/HStack/Text layout → LAYOUT opcodes (zero-alloc during layout)
└── pathland-host/     # host reader: ring → render tree (std convenience layer)
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

## Layout example

```rust
use pathland_layout::{view, LayoutEngine, Rect, Component};
use pathland_opcode::{init_memory, Guest, MemoryLayout};

let layout = MemoryLayout::default();
let mut mem = vec![0u8; layout.total_bytes()];
init_memory(&mut mem, &layout);

let mut root = view::vstack(4.0, 8.0, vec![
    view::text(1, "Hello"),
    view::text(2, "World"),
]);
let mut next = 1;
view::assign_ids(&mut root, &mut next);

let mut guest = Guest::new(&mut mem, &layout);
guest.begin_frame();
LayoutEngine::layout(&root, Rect::new(0.0, 0.0, 100.0, 100.0), &mut guest).unwrap();
guest.end_frame();
```

The layout pass allocates nothing; opcodes are written directly into the ring.
