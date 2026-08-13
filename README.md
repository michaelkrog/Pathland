# Pathland Protocol

> A cross-platform, cross-language UI protocol inspired by SwiftUI

## New Direction (Rust WASM Opcode Engine)

As of August 2026 Pathland is pivoting to a **Rust WASM guest engine** that
emits a fixed **16-byte opcode ring buffer** into shared linear memory, consumed
by host renderers. Components and modifiers are written in Rust with a
SwiftUI-like API and exposed to other languages via **WASM/WIT**. See
[`spec/OPCODE.md`](./spec/OPCODE.md) (supersedes `spec/BINARY_PROTOCOL.md`) and
the Rust workspace under [`lib/rust/`](./lib/rust/). The TypeScript
implementation in [`lib/typescript/`](./lib/typescript/) is kept for reference.

## Overview

Pathland is a **protocol-first** UI framework designed to enable retained-mode UI development with multiple renderer backends. It's inspired by SwiftUI's declarative syntax, but designed to be **language-agnostic** and **platform-agnostic**.

The same application + binary protocol renders on different surfaces: today there is a **DOM** renderer, and the interface is designed so any renderer (canvas, native, SVG, terminal, embedded) can be added.

## Core Principles

- **Protocol-first**: Standardized, open protocol for UI components, events, and gestures
- **Command-based**: UI updates transmitted as **commands** (CREATE_NODE, DELETE_NODE, INSERT_CHILD, REMOVE_CHILD, SET_PROPERTY, MOVE_CHILD, RESET) rather than complete trees
- **Binary Protocol**: Custom binary instruction protocol (bytecode/ABI) optimized for frequent tree mutations
- **Stateless Renderers**: Renderers are pure functions of the command stream. They retain only their own **rendered-output tree** (id → output + layout) for drawing and input routing — never application state
- **Language-agnostic wire**: events and gestures travel as binary protocol instructions (`DISPATCH_EVENT`, `GESTURE_UPDATE`) in both directions, so any app language can talk to any renderer language
- **Renderer-agnostic**: Supports server-owned, SSR, prerendered, and client-rendered apps simultaneously
- **Worker-first**: By default the application runs in a worker thread; only rendering happens on the main thread
- **SwiftUI-inspired**: Syntax and concepts aligned with SwiftUI design

## Documentation

### Protocol Specification

- [Binary Protocol](./spec/BINARY_PROTOCOL.md) - **Primary specification** - Custom binary instruction protocol with opcodes, component types, property IDs, and encoding rules
- [Protocol Overview](./spec/PROTOCOL.md) - Core protocol concepts and architecture
- [Component Specifications](./spec/components/COMPONENTS.md) - Detailed component definitions
- [Event System](./spec/events/EVENTS.md) - Complete event system specification
- [Conformance Test Vectors](./spec/CONFORMANCE.md) - Golden byte arrays for validating implementations

## Proof of Concept (POC)

A working implementation is available in the [`/poc/`](./poc/) directory. It renders the **same** application (`src/app.ts`) through the **DOM renderer**:

- [`index.html`](./poc/index.html) - the **DOM renderer** (`@pathland/renderer-dom`)

The app runs in a **worker thread** (`src/worker.ts`) and emits binary commands to the renderer on the main thread; renderer events/gestures flow back as binary instructions.

**11 demos**:
1. Simple VStack with Text (semantic colors)
2. HStack with Spacer
3. Nested Stacks
4. Styled components (background, padding, opacity)
5. **Live Clock** - real-time clock (worker-generated `SET_PROPERTY` every second)
6. **Counter with Signals** - tap to increment (event round-trips through the worker)
7. **Conditional Rendering** (`If`)
8. **For Loop** (`For`) - list with add/remove (positional diffing reuses unchanged nodes)
9. **Switch** (`Switch`) - multi-way branch
10. **Long-Press & Hover** - discrete events with payloads
11. **Drag Gesture** - SwiftUI-style `DragGesture` lifecycle through the worker

To run the POC:
```bash
cd poc
npm install
npm run dev
```

Then open `http://localhost:3000`.

## TypeScript Libraries

The implementation is a monorepo under [`lib/typescript/`](./lib/typescript/):

| Package | Responsibility |
|---------|----------------|
| `@pathland/protocol` | Binary encoding/decoding, constants, types (no dependencies) |
| `@pathland/renderer` | `Renderer` interface + shared `PointerInteraction` recognizer |
| `@pathland/transport` | Message serialization + transports (WebSocket, postMessage, memory) |
| `@pathland/view` | Reactive view framework (signals, components, control flow, SwiftUI-style gestures) |
| `@pathland/platform-browser` | `bootstrapApplication` (worker mode) + `startWorker` |
| `@pathland/renderer-dom` | DOM renderer — hand-rolled custom elements with shadow DOM for hard CSS encapsulation (+ `@pathland/renderer-dom/jsdom` for Node/SSR) |

## Implemented Components

All 12 component types have full binary protocol support:

| Component | Type ID | Description |
|-----------|---------|-------------|
| `HSTACK` | `0x0001` | Horizontal stack container |
| `VSTACK` | `0x0002` | Vertical stack container |
| `TEXT` | `0x0003` | Text display with styling |
| `BUTTON` | `0x0004` | Interactive button |
| `IMAGE` | `0x0005` | Image display (properties TBD) |
| `SWITCH` | `0x0006` | Toggle switch |
| `TEXT_FIELD` | `0x0007` | Text input field |
| `SPACER` | `0x0008` | Flexible spacer (fills available space) |
| `SCROLLVIEW` | `0x0009` | Scrollable container (experimental) |
| `LIST` | `0x000A` | Virtualized list container (experimental) |
| `GRID` | `0x000B` | Grid container (experimental) |
| `COMMENT` | `0x000C` | Non-rendered comment node (experimental) |

### Supported Properties

**Stack Properties (HSTACK/VSTACK):**
- `SPACING` (0x0001) - Gap between children
- `ALIGNMENT` (0x0002) - Cross-axis alignment
- `JUSTIFICATION` (0x0003) - Main-axis distribution
- `PADDING` (0x0004) - Uniform inner padding

**Text Properties:**
- `TEXT` (0x000A) - Text content
- `LINE_LIMIT` (0x000B) - Maximum lines
- `TEXT_ALIGNMENT` (0x000C) - Text alignment
- `TRUNCATION_MODE`, `LINE_SPACING`, `BASELINE_OFFSET`

**Style Properties (any component):**
- `BACKGROUND_COLOR` (0x1001), `COLOR` (0x100A) - semantic token or literal sRGB
- `FONT_SIZE` (0x1007), `FONT_WEIGHT` (0x1008), `FONT_FAMILY` (0x1009)
- `BORDER_WIDTH` (0x1003), `BORDER_COLOR` (0x1004), `BORDER_RADIUS` (0x1005)
- `PADDING` (0x1006), plus **per-edge** `PADDING_TOP/RIGHT/BOTTOM/LEFT` (0x1012-0x1015)
- `WIDTH` (0x100B) / `HEIGHT` (0x100C) - `-1` = FILL, `-2` = HUG_CONTENT
- `OPACITY` (0x100D), `VISIBLE` (0x100E), `Z_INDEX` (0x100F), `CLIPS_TO_BOUNDS` (0x1010)

**Semantic Properties:**
- `ROLE` (0x2001), `STATE` (0x2002), `ENABLED` (0x2003), `SELECTED` (0x2004)

For full component specifications, see [COMPONENTS.md](./spec/components/COMPONENTS.md).

## Architecture

### Command-Based Protocol

The protocol transmits **tree mutations** as a stream of binary instructions:

| Opcode | Name | Direction |
|--------|------|-----------|
| 0x01 | `CREATE_NODE` | Application → Renderer |
| 0x02 | `DELETE_NODE` | Application → Renderer |
| 0x03 | `INSERT_CHILD` | Application → Renderer |
| 0x04 | `REMOVE_CHILD` | Application → Renderer |
| 0x05 | `SET_PROPERTY` | Application → Renderer |
| 0x06 | `SET_DESIGN_TOKEN` | Application → Renderer |
| 0x07 | `DISPATCH_EVENT` | Renderer → Application |
| 0x08 | `REGISTER_EVENT_HANDLER` | Application → Renderer |
| 0x09 | `GESTURE_UPDATE` | Renderer → Application |
| 0x0A | `ATTACH_GESTURE` | Application → Renderer |
| 0x0B | `COMBINE_GESTURES` | Application → Renderer |
| 0x0C | `MOVE_CHILD` | Application → Renderer |
| 0x0D | `RESET` | Application → Renderer |

Tree mutations travel application → renderer; events and gestures travel renderer → application. **Both directions use the same binary instruction format**, making the wire language- and platform-agnostic.

### Message Format

Each message contains:
- Header: version (u16) + instruction count (u32)
- Body: a sequence of length-prefixed instructions

### Binary Encoding

- **Instruction framing**: `[u8 opcode][u16 payloadLength][payload...]` - unknown opcodes are safely skippable (forward compatible)
- **Node IDs**: u32 (4 bytes)
- **Component Types**: u16 (2 bytes)
- **Property IDs**: u16 (2 bytes)
- **Value Types**: u8 (1 byte) with typed payloads
- **Strings**: u32 length prefix + UTF-8 bytes
- **Colors**: Tagged union (semantic token or packed sRGB RGBA u32)
- **Design tokens**: referenced by dot-separated string paths (e.g. `color.primary`)

For complete encoding details, see [BINARY_PROTOCOL.md](./spec/BINARY_PROTOCOL.md).

### Worker Bootstrap

By default the application runs in a **worker thread**; only rendering happens on the main thread:

```
Worker (application)  ──binary mutations──▶  Main (renderer)
   ▲                                            │
   └────────────── binary events/gestures ──────┘
```

- The worker builds the view tree and emits binary command batches (`ArrayBuffer` + transferable).
- The renderer executes them and dispatches events/gestures back as binary `DISPATCH_EVENT` / `GESTURE_UPDATE` instructions.
- The **application owns the worker entry** (bundler-independent): a small module that imports the app and calls `startWorker(() => App)`. `bootstrapApplication` accepts the worker URL (or a pre-built `Worker`, or a `View` class for non-worker mode).

### Renderer Memory Model

A renderer is a pure function of the command stream. It MAY retain its **rendered-output tree** (id → output element + computed layout) for drawing, hit-testing, and event routing — but it MUST NOT retain application state. See [spec/PROTOCOL.md](./spec/PROTOCOL.md#33-renderer-memory-model).

## Event & Gesture System

The protocol has a complete event and gesture system with binary encoding:

- **Discrete events** (`DISPATCH_EVENT`): TAP, DOUBLE_TAP, LONG_PRESS, CLICK, HOVER (with `isHovering`), FOCUS, BLUR, KEY_DOWN, KEY_UP, SCROLL, SWIPE, ON_APPEAR, ON_DISAPPEAR, ON_CHANGE - each with a typed payload (coordinates, keyCode, modifiers, tapCount, …)
- **Stateful gestures** (`ATTACH_GESTURE` + `GESTURE_UPDATE`): tap, long-press, and drag with a began → changed → ended/cancelled lifecycle and per-state payloads (translation, velocity, duration, pressure)
- **SwiftUI-style view API**: `DragGesture()`, `LongPressGesture()`, `TapGesture()` with chainable `.onBegan/.onChanged/.onEnded/.onCancelled`, attached via `.gesture(...)`; plus `.onTapGesture {}` / `.onLongPressGesture {}` sugar

Event coordinates are **viewport-relative logical points** (see [BINARY_PROTOCOL.md](./spec/BINARY_PROTOCOL.md)).

## Getting Started

### For Protocol Implementers

1. Read the [Binary Protocol](./spec/BINARY_PROTOCOL.md)
2. Study the [Component Specifications](./spec/components/COMPONENTS.md)
3. Review the [Event System](./spec/events/EVENTS.md)
4. Validate against the [Conformance Vectors](./spec/CONFORMANCE.md)
5. Implement a renderer for your target platform (see `@pathland/renderer-dom` as a reference)

### For Application Developers

1. Use a Pathland-compatible library for your language
2. Build component trees using HStack, VStack, and Text
3. Add modifiers for styling and layout
4. Register event handlers / attach gestures

**Worker-mode example** (TypeScript):

```typescript
// worker.ts - the application-owned worker entry
import { startWorker } from '@pathland/platform-browser/worker';
import App from './app';
startWorker(() => App);
```

```typescript
// main.ts
import { bootstrapApplication } from '@pathland/platform-browser';
import workerUrl from './worker?worker&url';
bootstrapApplication(workerUrl);
```

**Render on a different surface** (write once, run anywhere): pass a custom `Renderer` implementation (canvas, native, SVG, terminal, …) to `bootstrapApplication`:

```typescript
import { bootstrapApplication } from '@pathland/platform-browser';
import { MyRenderer } from './my-renderer';
bootstrapApplication(workerUrl, { renderer: new MyRenderer(...) });
```

## Versioning

Pathland follows **Semantic Versioning** (Major.Minor.Patch):
- **Major**: Breaking changes
- **Minor**: Backward-compatible new features
- **Patch**: Backward-compatible bug fixes

Current version: **1.0.0-alpha** (wire protocol version 1)

## Contributing

Contributions are welcome! Please see the [LICENSE](LICENSE) file for licensing information.

## License

Pathland is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.
