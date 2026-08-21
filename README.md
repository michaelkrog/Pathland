# Pathland Protocol

> A cross-platform, cross-language UI protocol inspired by SwiftUI

## Overview

Pathland is a **protocol-first** UI framework for **retained-mode UI** with
multiple renderer backends. It's inspired by SwiftUI's declarative syntax, but
designed to be **language-agnostic** and **platform-agnostic**.

As of August 2026 the core is a **Rust opcode engine**. It emits the
application's **declarative view structure** — VStack, HStack, Text, spacing,
padding, alignment — as a fixed **16-byte opcode ring buffer** into shared
linear memory. Each platform's renderer maps the opcode stream onto that
platform's **native elements** (GTK4 widgets on desktop, DOM elements in the
browser, HTML server-side) and those native elements lay themselves out.

On desktop the engine runs **natively**: other languages drive it through the
flat **native C ABI** (`pathland-native`) over a zero-copy shared ring and render
through the shared GTK renderer (`pathland-gtk`). **WASM/WIT are the
browser/remote projection only**, not the primary path.

**The engine does not compute layout and does not emit rects.** It describes
*what* the UI is, never *where* it is. Emission is **diff-based and reactive**:
signals in the application ensure only changed nodes emit opcodes, so an
unchanged tree emits zero opcodes.

## The Three Elements

Pathland is composed of three elements. They are the vocabulary the whole
project speaks, so they are settled and used consistently:

```
┌────────────────────┐        ┌─────────────────────┐
│ 1. Retained UI     │        │ 3. Renderer         │
│ the app's UI tree  │────┐   │ maps opcodes onto   │
│ (any language,     │    │   │ native elements +   │
│  any platform)     │    │   │ event reporting     │
└────────────────────┘    │   └───────────▲─────────┘
                         │                │
┌────────────────────┐    │                │
│ 2. Opcode engine   │◄───┘                │
│ diffs + emits      │─────────────────────┘
└────────────────────┘
```

1. **Retained UI** — the application's canonical retained UI tree. It is the
   single source of truth, owned by the application. It can be authored in
   **any language on any platform**: Rust, Java, Swift, C#, C, TypeScript —
   desktop, mobile, embedded, or web — through a generated DSL, a WIT binding,
   or the flat native C ABI.
2. **Opcode engine** — walks the retained tree, diffs it, and emits fixed
   **16-byte opcodes** (the producer). Emission is reactive: only changed nodes
   emit, so an unchanged tree emits zero opcodes. The engine is
   language-independent — the same opcode stream serves every renderer.
3. **Renderer** — consumes the opcode stream and maps it onto that platform's
   **native elements**, and reports raw inputs back as events. It is a pure
   function of the opcode stream (stateless) and never retains application
   state. *"Host" and "driver" are roles a renderer plays: it runs inside a
   host and is pumped by a driver — they are not separate elements.* The same
   opcode stream targets **different UI systems**: a GTK4 renderer on desktop,
   an AppKit/SwiftUI renderer on macOS, a WinUI renderer on Windows, an LVGL
   renderer on embedded, a DOM renderer in the browser.

The opcodes are carried from the engine to the renderer by a transport (a
zero-copy shared-memory ring on desktop/native, a serialized network batch for
remote/browser); transport is an implementation detail, not a fourth element.

## Core Principles

- **Protocol-first**: standardized, open protocol for UI components, events, and raw inputs
- **16-byte opcodes**: every instruction is a fixed 16 bytes — cache-line aligned, deterministic, linear decode
- **Declarative, not positioned**: the engine emits structure + constraint properties (spacing, padding, alignment); native renderers compute positions
- **Native elements everywhere**: GTK4 widgets, DOM elements, HTML — never a generic canvas unless a platform has no native equivalent
- **Reactive emission**: only the nodes that changed emit opcodes; steady state emits zero
- **Command-based**: UI updates are tree mutations (CREATE_NODE, DELETE_NODE, INSERT_CHILD, MOVE_CHILD, …), never serialized trees
- **Stateless renderers**: renderers are pure functions of the opcode stream; they retain only their own rendered output, never application state
- **Zero-copy**: ring and arena are plain regions of shared linear memory
- **Single-producer / single-consumer**: guest engine produces; host renderer consumes
- **Catalog-driven DSL**: the ergonomic SwiftUI-like DSL in any language is generated from a single YAML catalog (`lib/ui/`), not hand-written

## Documentation

### Specification

- [Opcode Protocol](./spec/OPCODE.md) — **Primary specification** — fixed 16-byte opcodes, ring buffer, arena, reactive emission, design tokens
- [Conformance Test Vectors](./spec/CONFORMANCE.md) — golden byte arrays for validating implementations

## Rust Workspace

The implementation is under [`lib/rust/`](./lib/rust/):

| Crate | Responsibility |
|-------|----------------|
| `pathland-opcode` | 16-byte opcode, ring buffer, bump arena, linear-memory layout (`no_std`) |
| `pathland-view` | SwiftUI-style view DSL: VStack/HStack/Text/Button + chainable modifiers (`no_std`) |
| `pathland-engine` | Retained view tree → declarative `TREE`/`STYLE` opcodes; diff-based reactive emission (zero-alloc steady state) |
| `pathland-host` | Host reader: ring → native-element description (`std` convenience layer) |
| `pathland-transport` | Opcode transport: shared-memory ring + network batch encode/decode + transport abstraction |
| `pathland-native` | Native C-ABI shim + `NativeHost`: flat world over a zero-copy shared ring (Swift/Java/C#…) |
| `pathland-gtk` | GTK4 renderer (rlib + cdylib): opcode frames → native GTK widgets, incrementally |
| `pathland-gtk-demo` | Rust GTK4 demo: authors the DSL, renders through `pathland-gtk` (no GTK APIs) |
| `pathland-codegen` | DSL code generator: parses `lib/ui/components.yaml`, asserts ids, emits the Java DSL |
| `pathland-guest` | WASM guest component (browser/remote only) |
| `pathland-wit-host` | WIT host bindings + DSL bridge (browser/remote only) |

The DSL catalog lives in [`lib/ui/components.yaml`](./lib/ui/components.yaml);
regenerate the Java DSL with `./generate.sh`.

### Run tests

```bash
cd lib/rust
cargo test
```

### Run the demos (native, zero-copy shared ring + GTK renderer)

```bash
# Rust demo
cd lib/rust && PATH="$HOME/.cargo/bin:$PATH" cargo run -p pathland-gtk-demo

# Java demo (JNA over pathland-native + pathland-gtk)
PATH="$HOME/.cargo/bin:$PATH" cargo build -p pathland-native -p pathland-gtk
cd lib/java/pathland-demo && mvn -q -Dpathland.rust.target=<lib/rust/target/debug> compile exec:java
```

On macOS the Java demo must run GTK on the main thread:
`MAVEN_OPTS="-XstartOnFirstThread"`.

### Build for wasm32 (browser projection only)

```bash
RUSTC=~/.rustup/toolchains/stable-aarch64-apple-darwin/bin/rustc \
  cargo build --target wasm32-unknown-unknown
```

## Components & Properties

Component and property IDs are defined in `pathland-opcode`'s
[`constants.rs`](./lib/rust/crates/pathland-opcode/src/constants.rs) and
documented in [OPCODE.md](./spec/OPCODE.md). Component types include `HSTACK`,
`VSTACK`, `TEXT`, `BUTTON`, `SPACER`, and more; stack constraint properties
(`SPACING`, `ALIGNMENT`, …) drive native layout, styling modifiers (`PADDING`,
`COLOR`, `BACKGROUND_COLOR`, …) decorate any view, and `WIDTH`/`HEIGHT`
use `-1` = FILL, `-2` = HUG_CONTENT.

## Design Tokens

The renderer owns default token values; the application owns overrides.
Tokens are identified by dot-separated paths (`color.primary`, `space.2`) and
referenced via the `DESIGN_TOKEN` value type or overridden globally with
`SET_DESIGN_TOKEN`. See [Design Token System](./spec/OPCODE.md#design-token-system).

## Roadmap (POC Goals)

See the GitHub issues (#12, #13, #15, #16, #18):

1. **16-byte opcode engine** — done
2. **Core components & modifiers in Rust** (SwiftUI-like API) — done
3. **Opcode transport layer** (shared memory + network batch + native C-ABI shim) — done
4. **Rust desktop app with GTK4 renderer** (native shared ring) — done
5. **Catalog-driven DSL** (YAML → Java via `pathland-codegen`) — done
6. Quarkus SSR + WebSocket demo — planned

## Versioning

Pathland follows **Semantic Versioning** (Major.Minor.Patch). The wire protocol
version is 1 (see [OPCODE.md](./spec/OPCODE.md)).

## License

Pathland is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.
