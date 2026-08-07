# Pathland Project - AI Agent Guide

This document provides essential context for AI agents (or human contributors) working on the **Pathland** protocol. It captures the project's direction, architectural decisions, and implementation details to ensure consistency.

**Last Updated**: August 7, 2026

---

## Project Vision

**Pathland is a cross-platform, cross-language UI protocol** that enables retained-mode UI development with multiple renderer backends. It is **protocol-first**, meaning the binary protocol specification is the source of truth, not any particular implementation.

**Primary Goal**: Write once, run anywhere - Enable UI code to be written once and deployed across web, mobile, desktop, and embedded platforms through different renderer implementations.

**Status**: The protocol + worker bootstrap + DOM renderer + Canvas 2D renderer are implemented and tested end-to-end.

---

## CRITICAL ARCHITECTURAL PRINCIPLES

### Principle 1: Renderer Statelessness (NON-NEGOTIABLE)

> **The renderer MUST NOT retain application state.**

- Renderers are **pure functions** of the command stream: same commands → same output
- A renderer MAY retain its **rendered-output tree** (id → output + computed layout) for drawing, hit-testing, and event routing — this is a cache of its own output, not state
- The renderer MUST NOT retain component property values as business state, application control flow, or anything the application can change without sending a command
- The application owns the canonical retained UI tree
- See **Renderer Memory Model** in `spec/PROTOCOL.md` (section 3.3)

**Violation of this principle is a bug, not a feature.**

### Principle 2: Command-Based Protocol (NON-NEGOTIABLE)

> **The protocol transmits tree mutations as a stream of commands, NOT as serialized trees.**

- Each message contains a **batch of commands** describing changes
- Only **actual changes** are transmitted
- Protocol acts like a **VM instruction stream** / ABI
- Deterministic, linear decoding without schema lookup or reflection

### Principle 3: Binary Protocol (NON-NEGOTIABLE)

> **The protocol MUST be binary.**

- Open-source, cross-platform binary format
- Works with ArrayBuffer via transferable objects in browsers
- Custom instruction-based bytecode, not schema-driven serialization
- **Both directions are binary**: tree mutations (app → renderer) AND events/gestures (renderer → app) share the same instruction format, so the wire is language- and platform-agnostic

---

## Protocol Quick Reference

### Message Structure

```
Header (6 bytes):
  - version: u16 (2 bytes, currently 1)
  - instructionCount: u32 (4 bytes)
Body: length-prefixed instructions
  - [u8 opcode][u16 payloadLength][payload...]
```

### Opcodes (u8)

| Opcode | Value | Direction | Status |
|--------|-------|-----------|--------|
| CREATE_NODE | 0x01 | App → Renderer | Implemented |
| DELETE_NODE | 0x02 | App → Renderer | Implemented |
| INSERT_CHILD | 0x03 | App → Renderer | Implemented |
| REMOVE_CHILD | 0x04 | App → Renderer | Implemented |
| SET_PROPERTY | 0x05 | App → Renderer | Implemented |
| SET_DESIGN_TOKEN | 0x06 | App → Renderer | Implemented |
| DISPATCH_EVENT | 0x07 | Renderer → App | Implemented |
| REGISTER_EVENT_HANDLER | 0x08 | App → Renderer | Implemented |
| GESTURE_UPDATE | 0x09 | Renderer → App | Implemented |
| ATTACH_GESTURE | 0x0A | App → Renderer | Implemented |
| COMBINE_GESTURES | 0x0B | App → Renderer | Specified |
| MOVE_CHILD | 0x0C | App → Renderer | Implemented |
| RESET | 0x0D | App → Renderer | Implemented |

### Component Types (u16)

| Component | ID | Status |
|-----------|----|--------|
| HSTACK | 0x0001 | Implemented |
| VSTACK | 0x0002 | Implemented |
| TEXT | 0x0003 | Implemented |
| BUTTON | 0x0004 | Implemented |
| IMAGE | 0x0005 | Specified (props TBD) |
| SWITCH | 0x0006 | Specified |
| TEXT_FIELD | 0x0007 | Specified |
| SPACER | 0x0008 | Implemented |
| SCROLLVIEW | 0x0009 | Experimental |
| LIST | 0x000A | Experimental |
| GRID | 0x000B | Experimental |
| COMMENT | 0x000C | Experimental |

### Key Property IDs

**Stack**: SPACING=0x0001, ALIGNMENT=0x0002, JUSTIFICATION=0x0003, PADDING=0x0004, CONTENT_MARGINS=0x0005  
**Text**: TEXT=0x000A, TEXT_ALIGNMENT=0x000C, LINE_LIMIT=0x000B, TRUNCATION_MODE=0x000D  
**Style**: COLOR=0x100A, FONT_SIZE=0x1007, FONT_WEIGHT=0x1008, FONT_FAMILY=0x1009, BACKGROUND_COLOR=0x1001, BORDER_WIDTH=0x1003, BORDER_COLOR=0x1004, BORDER_RADIUS=0x1005, OPACITY=0x100D, VISIBLE=0x100E, Z_INDEX=0x100F, CLIPS_TO_BOUNDS=0x1010, PADDING_TOP/RIGHT/BOTTOM/LEFT=0x1012-0x1015  
**Special**: WIDTH=0x100B (use -1=FILL, -2=HUG_CONTENT), HEIGHT=0x100C  
**Semantic**: ROLE=0x2001, STATE=0x2002, ENABLED=0x2003, SELECTED=0x2004

### Event Types (u8)

TAP=0x01, DOUBLE_TAP=0x02, LONG_PRESS=0x03, CLICK=0x04, HOVER=0x05, FOCUS=0x06, BLUR=0x07, KEY_DOWN=0x08, KEY_UP=0x09, SCROLL=0x0A, SWIPE=0x0B, ON_APPEAR=0x0C, ON_DISAPPEAR=0x0D, ON_CHANGE=0x0E

### Gesture Types (u8) and States

TAP_GESTURE=0x10, LONG_PRESS_GESTURE=0x11, DRAG_GESTURE=0x12, SWIPE=0x13, PINCH=0x14, ROTATE=0x15  
States: BEGAN=0x00, CHANGED=0x01, ENDED=0x02, CANCELLED=0x03

### Colors

- Tagged union: semantic token (u16) or literal sRGB (u32 0xAARRGGBB)
- ALL literal colors are **sRGB** with D65 white point
- Semantic tokens: PRIMARY_TEXT=0x0001, SECONDARY_TEXT=0x0002, TERTIARY_TEXT=0x0003, BACKGROUND=0x0004, SURFACE=0x0005, ACCENT=0x0006, ERROR=0x0007, SUCCESS=0x0008, WARNING=0x0009, INFO=0x000A, BORDER=0x000B, SEPARATOR=0x000C

### Special Constants

```typescript
ROOT_CONTAINER_ID = 0
FILL = -1.0
HUG_CONTENT = -2.0
LITTLE_ENDIAN = true
PROTOCOL_VERSION = 1
```

---

## Design Token System

**Core Principle**: Application defines intent and overrides. Renderer defines visual appearance and behavior.

**Renderer Responsibilities**:
- Owns design tokens and default values
- Resolves semantic tokens to concrete visuals
- Defines interaction states (hover, pressed, focus, disabled)
- Applies theme logic

**Protocol MUST NEVER**:
- Describe hover styles, click styles, visual transitions
- Include conditional styling rules
- Specify layout tuning for interaction states

`SET_DESIGN_TOKEN` identifies tokens by **dot-separated string paths** (e.g. `color.primary`, `space.2`) with the standard value-type encoding — there is no separate numeric tokenId system.

---

## Worker Architecture

By default the application runs in a **worker thread**; only rendering runs on the main thread.

```
Worker (application)  ──binary mutations──▶  Main (renderer)
   ▲                                            │
   └────────────── binary events/gestures ──────┘
```

- The worker builds the view tree and emits binary command batches (`ArrayBuffer` + transferable via `createTransferable`).
- The main thread decodes and executes them with the renderer; `WorkerManager` routes `READY`/`ERROR`/`BINARY`.
- The renderer dispatches events/gestures back as binary `DISPATCH_EVENT` / `GESTURE_UPDATE`, which the worker decodes and routes to `handleDispatchEvent` / `handleGestureUpdate`.
- **The application owns the worker entry** (bundler-independent): a module that calls `startWorker(() => App)`; `bootstrapApplication` takes the worker URL, a `Worker`, or a `View` class (non-worker fallback).
- `READY`/`ERROR` are transport-level control messages (not protocol).

## Event & Gesture Model

- **Discrete events** travel as binary `DISPATCH_EVENT` with per-type payloads (coordinates, tapCount, keyCode, modifiers, hover `isHovering`, …). renderer-dom and renderer-canvas dispatch them via `Renderer.setupEvents((nodeId, eventType, data?) => void)`.
- **Stateful gestures** use `ATTACH_GESTURE` (register) + `GESTURE_UPDATE` (lifecycle: began/changed/ended/cancelled). renderer-dom and renderer-canvas dispatch via `Renderer.setupGestures((nodeId, gestureType, gestureState, data?) => void)`.
- **Shared recognition**: both renderers use the same `PointerInteraction` (`@pathland/renderer`) over a normalized pointer stream (down/move/up/cancel + logical points + optional raw target), with an injected hit-test. Click/hover can be synthesized from the stream (canvas) or from native DOM events (DOM).
- **View API (SwiftUI-style)**: `DragGesture()`, `LongPressGesture()`, `TapGesture()` with `.onBegan/.onChanged/.onEnded/.onCancelled`, attached via `.gesture(...)`; plus `.onTapGesture {}` / `.onLongPressGesture {}`. Discrete sugar (`tapGesture`, `longPressGesture`, `hoverGesture`, `focusGesture`, `blurGesture`) registers via `REGISTER_EVENT_HANDLER`.
- **Coordinates** are viewport-relative logical points.

---

## POC Implementation

**Location**: `/poc/`

**Structure**:
```
poc/
├── index.html           # DOM renderer page
├── canvas.html          # Canvas 2D renderer page
└── src/
    ├── app.ts           # The app: 11 demos (View classes)
    ├── worker.ts        # Worker entry: startWorker(() => POCApp)
    ├── main.ts          # DOM bootstrap: bootstrapApplication(workerUrl)
    ├── canvas-main.ts   # Canvas bootstrap: bootstrapApplication(workerUrl, { renderer })
    └── vite-env.d.ts    # Ambient types for Vite ?worker&url imports
```

**Running**: `cd poc && npm install && npm run dev` → http://localhost:3000 (DOM) or /canvas.html (Canvas). Both run in worker mode against the same `app.ts`.

**11 Demos**: simple VStack, HStack+Spacer, nested stacks, styled components, live clock, counter with signals, `If`, `For` (with positional diffing), `Switch`, long-press & hover, drag gesture.

---

## TypeScript Monorepo (`lib/typescript/`)

```
packages/
├── protocol/          # Binary encode/decode, constants, types (no deps)
├── renderer/          # Renderer interface + shared PointerInteraction
├── transport/         # serializeMessage/createTransferable + transports
├── view/              # View/ViewNode, Signal, components, control flow, gestures
├── platform-browser/  # bootstrapApplication, startWorker, WorkerManager
├── renderer-dom/      # DOM renderer (+ ./jsdom subpath for Node/SSR)
└── renderer-canvas/   # Canvas 2D renderer + retained layout engine
```

Dependency rule: packages depend only on packages to their left in the table above (see `lib/SPECIFICATION.md`). `npm test` at the monorepo root runs every package's suite.

## Implementation Guidelines

### Adding New Component
1. Add to `ComponentType` in `lib/typescript/packages/protocol/src/protocol/constants.ts`
2. Add to `spec/BINARY_PROTOCOL.md` + `spec/components/COMPONENTS.md`
3. Implement creation/properties in `renderer-dom/src/index.ts` AND `renderer-canvas/src/index.ts` (+ layout in `renderer-canvas/src/layout.ts`)

### Adding New Property
1. Add to the appropriate property enum in `constants.ts`
2. Add to the spec
3. Verify `binary.ts` encoder/decoder handles the value type
4. Implement in each renderer's property application

### Modifying Protocol
1. Update `spec/BINARY_PROTOCOL.md` first (and `spec/CONFORMANCE.md` vectors)
2. Update `constants.ts` / `types.ts`
3. Update `binary.ts` encode/decode
4. Verify backward compatibility; update the affected renderer + tests

### Changing the Wire Format
- Bump the wire `version` field (currently 1). Pre-release format changes are acceptable while version stays 1.

---

## Common Pitfalls

### NEVER Do These
| Anti-Pattern | Why Wrong | Correct |
|--------------|-----------|---------|
| Renderer stores application state | Violates statelessness | Application owns the tree |
| Send full trees | Inefficient | Send mutation commands only |
| String property names | Larger payloads | Use numeric IDs |
| String component names | Larger payloads | Use numeric IDs |
| Generic RGB | Ambiguous | Explicitly sRGB |
| Hover styles in protocol | Renderer job | Define in theme |
| App code uses `window`/`document` | Crashes in the worker | Use globals available in both scopes (e.g. `setInterval`) |
| JS-object event messages (e.g. `{type:'EVENT'}`) | Not protocol/portable | Use binary `DISPATCH_EVENT`/`GESTURE_UPDATE` |

---

## Project Status

**Complete**: Binary protocol (v1) with conformance vectors; worker bootstrap with symmetric binary transport; DOM + Canvas 2D renderers; shared `PointerInteraction`; full discrete event set; SwiftUI-style gestures (tap/long-press/drag); For-loop diffing; protocol gaps (MOVE_CHILD, RESET, EdgeInsets, coordinates, env requestId); renderer memory model docs; bundle hygiene. **106 tests green across 5 packages.**

**Planned / deferred**: pinch/rotate + multi-touch + `COMBINE_GESTURES`, capture/bubble propagation, keyed For reconciliation with moves, TEXT_FIELD editing, image rendering, more backends (SVG/terminal/native), Playwright E2E tests.

---

## Quick Start

1. Read this file and `spec/BINARY_PROTOCOL.md`
2. Run the POC: `cd poc && npm install && npm run dev` → http://localhost:3000 and /canvas.html
3. Run tests: `cd lib/typescript && npm test` (runs all packages)
4. Make small changes, verify they work

---

## Pathland Mindset

**Always remember**:
1. Protocol is King
2. Renderers are Dumb (execute commands only)
3. Applications are Smart (generate commands)
4. Only Changes Matter (transmit mutations)
5. Binary is Beautiful (efficient, deterministic)

**When in doubt**: Check `spec/BINARY_PROTOCOL.md`, the POC, and the reference implementation (`@pathland/protocol`). Ask: "Does this maintain stateless renderers?" "Does this only transmit actual changes?" "Is this representable in the binary protocol in any language?"
