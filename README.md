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
flat **native C ABI** (`pathland-view-native`) over a zero-copy shared ring and render
through the shared GTK renderer (`pathland-render-gtk`).

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
   desktop, mobile, or embedded — through a generated DSL or the flat native C
   ABI.
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
- **Hand-written Java DSL**: the SwiftUI-like view DSL lives as a reusable Java library (`com.pathland.view`), not generated code — one ergonomic surface for desktop, server (Spring/Quarkus), and embedded hosts

## Documentation

### Specification

- [Opcode Protocol](./spec/OPCODE.md) — **Primary specification** — fixed 16-byte opcodes, ring buffer, arena, reactive emission, design tokens
- [Conformance Test Vectors](./spec/CONFORMANCE.md) — golden byte arrays for validating implementations

## Rust Workspace

The implementation is under [`lib/rust/`](./lib/rust/):

| Crate | Element | Responsibility |
|-------|---------|----------------|
| `pathland-view` | Retained UI | SwiftUI-style view DSL: VStack/HStack/Text/Button + chainable modifiers (`no_std`) |
| `pathland-core` | Opcode engine | Retained tree types (`Node`/`Component`) + diff-based reactive emitter + reactive **signals** + 16-byte opcode, ring buffer, bump arena (`no_std`, zero-alloc steady state) |
| `pathland-core-transport` | Opcode engine | Transport: shared-memory ring + network batch encode/decode + batching policy (`std`) |
| `pathland-render-gtk` | Renderer | GTK4 renderer (rlib + cdylib): opcode frames → native GTK widgets, incrementally |
| `pathland-view-native` | Retained UI projection | Native C-ABI shim + `NativeHost`: flat world over a zero-copy shared ring (Swift/Java/C#…) |
| `pathland-core-capi` | Opcode engine | Minimal shared-memory ring C ABI (`libpathland_core`): create/destroy, ring push, frame boundaries, arena alloc, zero-copy read, event drain/send |
| `pathland-render-gtk-demo` | Demo | Rust GTK4 demo: authors the DSL, renders through `pathland-render-gtk` (no GTK APIs) |

## Java Libraries

The reusable, framework-agnostic Java libraries live under [`lib/java/`](./lib/java/)
(Maven reactor, `org.pathland`, Java 22+):

| Module | Package | Responsibility |
|--------|---------|----------------|
| `pathland-view` | `com.pathland.view` | SwiftUI-like view DSL (`View`, `VStack`, `Text`, `Button`, …), Angular-style signals/computed/effects (`com.pathland.view.signal`), fine-grained opcode emitter (`com.pathland.view.emit`), wire codec (`com.pathland.view.transport`), lazy FFM ring interop (`com.pathland.view.ffm`), cross-platform state (`com.pathland.view.state`) |
| `pathland-render-html` | `com.pathland.render.html` | Pure-function HTML renderer over the opcode stream (SSR) with `data-pathland-id` hydration |
| `pathland-state-redis` | `com.pathland.state.redis` | Redis-backed `StateStore` over Lettuce (Spring/Quarkus/desktop) |
| `pathland-quarkus-demo` | `com.pathland.demo` | Quarkus SSR + WebSocket demo consuming the libraries |

The same `com.pathland.view` DSL runs unchanged on a Spring Boot app, a Quarkus app,
or a desktop app; a desktop host pushes opcodes into the Rust ring via FFM
(`pathland_ring_buffer_push`), while a server emits self-contained frames over WebSocket.

### Build & run the Java libraries

```bash
# Rust ring C ABI (only needed for the desktop FFM path)
cd lib/rust && cargo build -p pathland-core-capi

# Build + test the whole Java reactor
cd lib/java && mvn -q install

# Run the Quarkus SSR + WebSocket demo (packaged runner)
cd lib/java/pathland-quarkus-demo
mvn -q package
java -jar target/quarkus-app/quarkus-run.jar   # http://localhost:8080
```

### Run tests

```bash
cd lib/rust && cargo test
cd lib/java && mvn test
```

### Run the GTK desktop demo (native, zero-copy shared ring)

```bash
cd lib/rust && PATH="$HOME/.cargo/bin:$PATH" cargo run -p pathland-render-gtk-demo
```

## Components & Properties

Component and property IDs are defined in `pathland-core`'s
[`constants.rs`](./lib/rust/crates/pathland-core/src/constants.rs) and
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
5. **Native Java library set** (hand-written `com.pathland.view` DSL + signals/computed/effects + reusable HTML renderer + state stores) — done
6. **Quarkus SSR + WebSocket demo** (SSR HTML via `pathland-render-html` + live 16-byte opcode deltas) — done

## Versioning

Pathland follows **Semantic Versioning** (Major.Minor.Patch). The wire protocol
version is 1 (see [OPCODE.md](./spec/OPCODE.md)).

## License

Pathland is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.
