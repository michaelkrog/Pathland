# Pathland Protocol

> A cross-platform, cross-language UI protocol inspired by SwiftUI

## Overview

Pathland is a **protocol-first** UI framework for **retained-mode UI** with
multiple renderer backends. It's inspired by SwiftUI's declarative syntax, but
designed to be **language-agnostic** and **platform-agnostic**.

As of August 2026 the core is a **Rust engine compiled to WASM** ("WASM guest
engine"). It emits the application's **declarative view structure** — VStack,
HStack, Text, spacing, padding, alignment — as a fixed **16-byte opcode ring
buffer** into shared linear memory. Each platform's renderer maps the opcode
stream onto that platform's **native elements** (GTK4 widgets, DOM elements,
HTML) and those native elements lay themselves out.

**The engine does not compute layout and does not emit rects.** It describes
*what* the UI is, never *where* it is. Emission is **diff-based and reactive**:
signals in the application ensure only changed nodes emit opcodes, so an
unchanged tree emits zero opcodes.

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
- **Worker-first heritage**: the architecture keeps the application logic separable from rendering, and WASM/WIT makes components consumable from any language

## Documentation

### Specification

- [Opcode Protocol](./spec/OPCODE.md) — **Primary specification** — fixed 16-byte opcodes, ring buffer, arena, reactive emission, design tokens
- [Conformance Test Vectors](./spec/CONFORMANCE.md) — golden byte arrays for validating implementations

## Rust Workspace

The implementation is under [`lib/rust/`](./lib/rust/):

| Crate | Responsibility |
|-------|----------------|
| `pathland-opcode` | 16-byte opcode, ring buffer, bump arena, linear-memory layout (`no_std`) |
| `pathland-engine` | Retained view tree → declarative `TREE`/`STYLE` opcodes; diff-based reactive emission (zero-alloc steady state) |
| `pathland-host` | Host reader: ring → native-element description (`std` convenience layer) |

### Run tests

```bash
cd lib/rust
cargo test
```

### Build for wasm32

```bash
RUSTC=~/.rustup/toolchains/stable-aarch64-apple-darwin/bin/rustc \
  cargo build --target wasm32-unknown-unknown
```

## Components & Properties

Component and property IDs are defined in `pathland-opcode`'s
[`constants.rs`](./lib/rust/crates/pathland-opcode/src/constants.rs) and
documented in [OPCODE.md](./spec/OPCODE.md). Component types include `HSTACK`,
`VSTACK`, `TEXT`, `BUTTON`, `SPACER`, and more; stack constraint properties
(`SPACING`, `PADDING`, `ALIGNMENT`, …) drive native layout, and `WIDTH`/`HEIGHT`
use `-1` = FILL, `-2` = HUG_CONTENT.

## Design Tokens

The renderer owns default token values; the application owns overrides.
Tokens are identified by dot-separated paths (`color.primary`, `space.2`) and
referenced via the `DESIGN_TOKEN` value type or overridden globally with
`SET_DESIGN_TOKEN`. See [Design Token System](./spec/OPCODE.md#design-token-system).

## Roadmap (POC Goals)

See the GitHub issues (#12, #13, #15, #16, #18):

1. **16-byte opcode engine** — done
2. Core components & modifiers in Rust (SwiftUI-like API)
3. **Opcode transport layer** (shared memory + network batch)
4. Rust desktop app with GTK4 renderer
5. Quarkus SSR + WebSocket demo

## Versioning

Pathland follows **Semantic Versioning** (Major.Minor.Patch). The wire protocol
version is 1 (see [OPCODE.md](./spec/OPCODE.md)).

## License

Pathland is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.
