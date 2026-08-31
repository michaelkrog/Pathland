# Pathland Protocol

> A cross-platform, cross-language UI protocol for declarative, retained-mode UI
>
> **Status: proof of concept.** Not production software — the wire format and APIs may change before 1.0.

## Overview

Pathland is a **protocol-first** UI framework for **retained-mode UI** with
multiple renderer backends. It offers a declarative, retained-mode view API
(SwiftUI-shaped in ergonomics) designed to be **language-agnostic** and
**platform-agnostic**.

As of August 2026 the core is a **Rust opcode engine**. It emits the
application's **declarative view structure** — VStack, HStack, Text, spacing,
padding, alignment — as a fixed **16-byte opcode ring buffer** into shared
linear memory. Each platform's renderer maps the opcode stream onto that
platform's **native elements** (GTK4 widgets on desktop, DOM elements in the
browser, HTML server-side) and those native elements lay themselves out.

On desktop the engine runs **natively**: other languages drive it through the
flat **native C ABI** (`pathland-view-native`) over a zero-copy shared ring and render
through the shared GTK renderer (`pathland-render-gtk`).

The **16-byte opcode engine is transport- and process-agnostic by design**. The
ring buffer is a plain region of shared linear memory, so the engine runs
wherever the producer and consumer can exchange bytes — no assumptions about
where the application lives. The same engine spans **embedded systems**
(FreeRTOS dual-core queues passing opcode slices between cores), **pure
in-browser client-side apps** (a WASM Web Worker producing into a
`SharedArrayBuffer` that the main-thread DOM renderer consumes), and
**server-driven enterprise architectures** (Java/C# backends emitting opcode
frames over WebSocket or gRPC). Transport and process boundaries are details of
delivery, never of the protocol.

**The engine does not compute layout and does not emit rects.** It describes
*what* the UI is, never *where* it is. Emission is **diff-based and reactive**:
change detection is fine-grained and signal-based — a signal bound to a node's
text or a property re-emits only that node's deltas, so only the things that
actually changed emit opcodes and an unchanged tree emits zero opcodes.

## Project Status

**Proof of concept.** Pathland is a working reference implementation for
validating the protocol, not production software. The 16-byte opcode engine,
the Rust and Java DSLs, the GTK4 / HTML / Angular renderers, and the
SSR + WebSocket demos are all functional (tests green), but the wire format
(version 1) and every API are subject to change before a 1.0.

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
│ reconciles + emits │─────────────────────┘
└────────────────────┘
```

1. **Retained UI** — the application's canonical retained UI tree. It is the
   single source of truth, owned by the application. It can be authored in
   **any language on any platform**: Rust, Java, Swift, C#, C, TypeScript —
   desktop, mobile, or embedded — through a generated DSL or the flat native C
   ABI.
2. **Opcode engine** — the producer: reconciles the retained tree and emits it as
   fixed **16-byte opcodes** using fine-grained, signal-based change detection: a
   signal bound to a node's text or a property re-emits only that node's deltas,
   so only the things that actually changed emit and an unchanged tree emits zero
   opcodes. The engine is language-independent — the same opcode stream serves
   every renderer. It spans a pure protocol core (`pathland-core`) and a
   retained-tree emitter (`pathland-engine`).
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

## Execution & Deployment Models

The fixed **16-byte opcode ring buffer** is what makes Pathland
*process-agnostic*: the producer and consumer only need to share a region of
memory (or a byte stream), so the exact same engine and wire format serve five
distinct execution modes.

### a) Embedded Dual-Core (In-Process)

Core 0 runs application logic and sensor handling; Core 1 decodes opcodes and
renders **LVGL** over a **zero-copy SRAM ring buffer** (e.g. ESP32). The `no_std`
protocol core (`pathland-core`) emits into shared SRAM; the second core drains
the ring and drives LVGL widgets. No heap, no serialization — just a 16-byte
opcode stream across cores, passed through a FreeRTOS queue or a direct
SRAM producer/consumer pair.

### b) In-Browser Pure Client (Zero Main-Thread Lock)

Application logic runs in a **Web Worker compiled to WASM**. It emits opcodes
into a **`SharedArrayBuffer`** that the main thread's DOM renderer consumes
directly — bypassing Virtual DOM diffing entirely, because the renderer applies
only the delta opcodes to the native DOM. Since the worker never blocks the main
thread and the renderer is a pure function of the stream, this path targets
better sustained frame rates than single-threaded JS frameworks for large,
reactive trees.

### c) Native Desktop (IPC / Shared Memory)

Native apps drive the engine through the flat **C ABI** (`pathland-view-native`)
or **Java FFM** over a **zero-copy shared ring** into GTK4 / native widgets
(`pathland-render-gtk`). This is the current desktop path — producer and
renderer live in the same process and share the ring directly.

### d) Distributed Network (Server-Driven UI)

Backends (**Java Spring / Quarkus, C#**) emit self-contained opcode frames over
**WebSocket** (implemented) and, planned, **gRPC** directly to **Web
(HTML / Angular)** or mobile renderers. Frames are self-contained `PLPL`
batches, so each message is independent — no shared memory and no session state
in the renderer.

### e) Microfrontend Composition (Server-Side Merging)

The retained-tree model also opens the door to **true microfrontends without the
JavaScript-bundle hassle**: the subtrees of different services can be merged
into **one UI tree server-side** and relayed to the renderer as a single opcode
stream, so teams can ship UI with their own backend and any renderer receives a
unified UI — with no per-microservice client code.

## Core Principles

- **Protocol-first**: standardized, open protocol for UI components, events, and raw inputs
- **16-byte opcodes**: every instruction is a fixed 16 bytes — cache-line aligned, deterministic, linear decode
- **Declarative, not positioned**: the engine emits structure + constraint properties (spacing, padding, alignment); native renderers compute positions
- **Native elements everywhere**: GTK4 widgets, DOM elements, HTML — never a generic canvas unless a platform has no native equivalent
- **Reactive emission**: fine-grained, signal-based change detection — only the nodes that actually changed emit opcodes; steady state emits zero
- **Command-based**: UI updates are tree mutations (CREATE_NODE, DELETE_NODE, INSERT_CHILD, MOVE_CHILD, …), never serialized trees
- **Stateless renderers**: renderers are pure functions of the opcode stream; they retain only their own rendered output, never application state
- **Zero-copy**: ring and arena are plain regions of shared linear memory
- **Single-producer / single-consumer**: guest engine produces; host renderer consumes
- **Hand-written Java DSL**: the declarative view DSL lives as a reusable Java library (`com.pathland.view`), not generated code — one ergonomic surface for desktop, server (Spring/Quarkus), and embedded hosts

## Documentation

### Specification

- [Opcode Protocol](./spec/OPCODE.md) — **Primary specification** — fixed 16-byte opcodes, ring buffer, arena, reactive emission, design tokens
- [Primitive Views](./spec/PRIMITIVES.md) — the primitive views the protocol supports (declarative view groupings), with protocol component IDs and status
- [Core Modifiers](./spec/MODIFIERS.md) — the core modifiers (protocol `STYLE` properties), with property IDs and status
- [Core Events](./spec/EVENTS.md) — the core events (raw inputs), with event command IDs and listener bits
- [Conformance Test Vectors](./spec/CONFORMANCE.md) — golden byte arrays for validating implementations

## Rust Workspace

The implementation is under [`lib/rust/`](./lib/rust/):

| Crate | Element | Responsibility |
|-------|---------|----------------|
| `pathland-view` | Retained UI | Declarative view DSL: VStack/HStack/Text/Button + chainable modifiers building a `pathland-engine::Node` tree (`no_std`) |
| `pathland-core` | Opcode engine | Protocol core: fixed 16-byte opcode, ring buffer, bump arena, events, memory layout, Guest/Host/Frame surface (`no_std`, zero-alloc) |
| `pathland-engine` | Opcode engine | Emitter: retained tree types (`Node`/`Component`) + diff-based reactive emission + reactive **signals** (moved out of `pathland-core`) |
| `pathland-core-transport` | Opcode engine | Transport: shared-memory ring + network batch encode/decode + batching policy (`std`) |
| `pathland-render-gtk` | Renderer | GTK4 renderer (rlib + cdylib): opcode frames → native GTK widgets, incrementally |
| `pathland-render-html` | Renderer | HTML renderer: maps opcode frames onto declarative HTML (flex stacks, spans, buttons) as a pure function of the stream — the server-side/remote target |
| `pathland-view-native` | Retained UI projection | Native C-ABI shim + `NativeHost`: flat world over a zero-copy shared ring (Swift/Java/C#…) |
| `pathland-core-capi` | Opcode engine | Minimal shared-memory ring C ABI (`libpathland_core`): create/destroy, ring push, frame boundaries, arena alloc, zero-copy read, event drain/send |
| `pathland-render-gtk-demo` | Demo | Rust GTK4 demo: authors the DSL, renders through `pathland-render-gtk` (no GTK APIs) |
| `pathland-web-worker` *(planned)* | Opcode engine / Renderer | WASM logic Worker + `SharedArrayBuffer` DOM driver: application logic emits opcodes in a Web Worker; the main-thread DOM renderer consumes them zero-copy (in-browser pure-client mode) |
| `pathland-esp32` *(planned)* | Renderer | Dual-core HAL driver for microcontrollers: Core 0 → Core 1 opcode slices over an SRAM ring, mapped onto LVGL widgets (embedded dual-core mode) |

`pathland-web-worker` and `pathland-esp32` are roadmap targets; the existing
`no_std`/WASM-capable core (`pathland-core`) and the ring C ABI
(`pathland-core-capi`) are the building blocks they are planned on.

## Java Libraries

The reusable, framework-agnostic Java libraries live under [`lib/java/`](./lib/java/)
(Maven reactor, `org.pathland`, Java 25+):

| Module | Package | Responsibility |
|--------|---------|----------------|
| `pathland-view` | `com.pathland.view` | Declarative view DSL (`View`, `VStack`, `Text`, `Button`, …), Angular-style signals/computed/effects (`com.pathland.view.signal`), fine-grained opcode emitter (`com.pathland.view.emit`), wire codec (`com.pathland.view.transport`), lazy FFM ring interop (`com.pathland.view.ffm`), cross-platform state (`com.pathland.view.state`: `StateStore`/`PersistentState`/`State`) |
| `pathland-view-processor` | `com.pathland.processor` | JSR 269 annotation processor: generates `<View>_StateBinder` for `State` fields (auto-keyed by field name) |
| `pathland-render-html` | `com.pathland.render.html` | Pure-function HTML renderer over the opcode stream (SSR) with `data-pathland-id` hydration |
| `pathland-state-redis` | `com.pathland.state.redis` | Redis-backed `StateStore` over Lettuce (Spring/Quarkus/desktop) |
| `pathland-demo-views` | `com.pathland.demo` | Shared kitchensink demo views (`KitchenSinkView` + per-section components) declaring `State` fields |
| `pathland-quarkus-demo` | `com.pathland.quarkus` | Quarkus SSR + WebSocket demo consuming the libraries |
| `pathland-spring-boot-demo` | `com.pathland.spring` | Spring Boot SSR + WebSocket demo consuming the same libraries |

The same `com.pathland.view` DSL (and `State` fields) runs unchanged on a Spring Boot
app, a Quarkus app, or a desktop app; a desktop host pushes opcodes into the Rust ring via
FFM (`pathland_ring_buffer_push`), while a server emits self-contained frames over WebSocket.

### Build & run the Java libraries

```bash
# Rust ring C ABI (only needed for the desktop FFM path)
cd lib/rust && cargo build -p pathland-core-capi

# Build + test the whole Java reactor (needs JDK 25: maven.compiler.release=25)
export JAVA_HOME=<jdk-25-home>
cd lib/java && mvn -q install

# Run the Quarkus SSR + WebSocket demo in dev mode (hot reload)
cd lib/java/pathland-quarkus-demo && mvn quarkus:dev      # http://localhost:8080

# ...or run the packaged runner
cd lib/java/pathland-quarkus-demo
mvn -q package
java -jar target/quarkus-app/quarkus-run.jar   # http://localhost:8080

# Run the Spring Boot SSR + WebSocket demo (same shared views)
cd lib/java/pathland-spring-boot-demo
mvn -q package
java -jar target/pathland-spring-boot-demo-0.1.0.jar   # http://localhost:8080
```

The libraries require **Java 25+** (`ScopedValue` is final only in JDK 25, JEP 506),
**Quarkus ≥ 3.18** (dev mode's class-file reader must understand Java 25), and
**Spring Boot ≥ 3.5** (Java 25 support).

### Run tests

```bash
cd lib/rust && cargo test
cd lib/java && mvn test
```

### Run the GTK desktop demo (native, zero-copy shared ring)

```bash
cd lib/rust && PATH="$HOME/.cargo/bin:$PATH" cargo run -p pathland-render-gtk-demo
```

## Angular Renderer (@apaq/ngui)

The browser also has a declarative renderer: an **Angular application** (under
[`lib/angular/`](./lib/angular/)) that maps the opcode stream onto the
**[@apaq/ngui](https://github.com/Apaq/ngui)** design system — `ui-vstack`/
`ui-hstack`/`ui-text`/`ui-button`/… views and `[padding]`/`[color]`/`[font]`/…
modifiers — instead of hand-written `app.js` DOM patches. It connects to the
Pathland `/ws` socket (the server replays the full mount frame on connect, so no
SSR pre-step is needed), decodes `PLPL` frames, and renders ngui views. See
[`lib/angular/README.md`](./lib/angular/README.md).

## Components & Properties

Component and property IDs are defined in `pathland-core`'s
[`constants.rs`](./lib/rust/crates/pathland-core/src/constants.rs),
documented in [OPCODE.md](./spec/OPCODE.md), and catalogued by category in
[PRIMITIVES.md](./spec/PRIMITIVES.md) (component types), [MODIFIERS.md](./spec/MODIFIERS.md)
(properties), and [EVENTS.md](./spec/EVENTS.md) (events). Component types
include `TEXT`, `BUTTON`, `VSTACK`, `HSTACK`, `SPACER`, and more; stack
constraint properties (`SPACING`, `ALIGNMENT`, …) drive native layout, styling
modifiers (`PADDING`, `COLOR`, `BACKGROUND_COLOR`, …) decorate any view, and
`WIDTH`/`HEIGHT` use `-1` = FILL, `-2` = HUG_CONTENT.

## Design Tokens

The renderer owns default token values; the application owns overrides.
Tokens are identified by dot-separated paths (`color.primary`, `space.2`) and
referenced via the `DESIGN_TOKEN` value type or overridden globally with
`SET_DESIGN_TOKEN`. See [Design Token System](./spec/OPCODE.md#design-token-system).

## POC Goals

See the GitHub issues (#12, #13, #15, #16, #18):

1. **16-byte opcode engine** — done
2. **Core components & modifiers in Rust** (declarative API) — done
3. **Opcode transport layer** (shared memory + network batch + native C-ABI shim) — done
4. **Rust desktop app with GTK4 renderer** (native shared ring) — done
5. **Native Java library set** (hand-written `com.pathland.view` DSL + signals/computed/effects + reusable HTML renderer + state stores) — done
6. **Quarkus SSR + WebSocket demo** (SSR HTML via `pathland-render-html` + live 16-byte opcode deltas) — done

## Versioning

Pathland follows **Semantic Versioning** (Major.Minor.Patch). The wire protocol
version is 1 (see [OPCODE.md](./spec/OPCODE.md)).

## License

Pathland is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.
