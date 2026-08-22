# Pathland Project - AI Agent Guide

This document provides essential context for AI agents (or human contributors) working on the **Pathland** protocol. It captures the project's direction, architectural decisions, and implementation details to ensure consistency.

**Last Updated**: August 21, 2026

---

## Architecture: Rust Opcode Engine

> The canonical core is a **Rust engine** that emits the application's
> **declarative view structure** — VStack, HStack, Text, spacing, padding,
> alignment — as a fixed **16-byte opcode ring buffer** into shared linear
> memory, consumed by host renderers. View components and modifiers are written
> in Rust with a SwiftUI-like API; other languages get the ergonomic DSL from a
> **catalog-driven code generator** (YAML → Java today) and drive the engine
> through the flat **native C ABI** (`pathland-view-native`) over a zero-copy shared
> ring on desktop.

### The 16-byte Opcode Engine

- Every opcode is exactly **16 bytes**: `Category (1B) | Command ID (1B) | Flags (2B) | A (4B) | B (4B) | C (4B)`, `#[repr(C, packed)]`, little-endian.
- A 64-byte cache line holds exactly **4 opcodes** → L1-cache-friendly.
- Opcodes live in a **ring buffer** in linear memory; the guest writes at `writeCursor`, the host reads from `readCursor`; frame boundaries via a monotonic `frameCount` in the header block.
- **Both directions are binary**: a second **event ring** (host → guest) carries `EVENT`-category opcodes. The renderer writes raw inputs at `eventWriteCursor`; the guest drains them at `eventReadCursor`. Events are 16-byte opcodes through the engine, never a side-channel callback.
- **Variable-length data** (strings, token paths) lives in a bump **arena**; opcodes reference entries by offset (`[u32 byteLength][bytes...]`), so every opcode stays 16 bytes.
- Spec: **`spec/OPCODE.md`** (primary) + **`spec/CONFORMANCE.md`** (golden vectors).

### Declarative, not positioned (NON-NEGOTIABLE)

> **The engine describes WHAT the UI is — VStack, HStack, Text, spacing,
> padding, alignment — never WHERE it is. It does not compute layout and does
> not emit rects.**

- The engine emits **declarative structure** (`TREE` create/delete/insert/remove/move) + **constraint properties** (`STYLE` spacing/padding/alignment/FILL/HUG hints).
- **Native elements everywhere**: each platform's renderer maps the opcode stream onto that platform's native elements — GTK4 widgets on desktop, DOM elements in the browser, HTML server-side — and those native elements lay themselves out. Never a generic canvas unless a platform has no native equivalent.
- **Reactive emission**: emission is diff-based. Only the nodes that changed emit opcodes (property diffs via `SET_PROPERTY`/`SET_TEXT`, structural diffs via `TREE` opcodes). An unchanged tree emits **zero** opcodes. Signals in the application mark the tree dirty; the engine reconciles.
- **Zero dynamic heap allocations** during steady-state emission (proven by test).

### no_std / wasm32 direction guard (NON-NEGOTIABLE)

`pathland-core` and `pathland-view` must remain `#![no_std]` + `alloc` and
compile for `wasm32-unknown-unknown`. This is the guarantee that the protocol
core can still target a browser / embedded / remote projection later (goal #15,
Quarkus SSR + WebSocket). The desktop path (`pathland-view-native`) is the only
consumer today, but the core must not become desktop-only. Verify with
`lib/rust/check-wasm.sh` (i.e. `cargo build -p pathland-core -p pathland-view
--target wasm32-unknown-unknown`).

### Rust Workspace (`lib/rust/`)

```
# ── The three elements ────────────────────────────────────────────────────
crates/pathland-view/     # RETAINED UI — SwiftUI-style view DSL: VStack/HStack/Text/Button +
                          #   decoupled modifiers (spacing/padding/fontSize/color/background)
                          #   + vstack!/hstack! macros (no_std)
crates/pathland-core/     # OPCODE ENGINE — retained tree types (Node/Component) + the
                          #   diff-based reactive emitter + 16-byte opcode, ring buffer,
                          #   arena, constants, events, memory layout (no_std, zero-alloc)
crates/pathland-core-transport/ # OPCODE ENGINE — transport: shared-memory ring owner +
                          #   network batch encode/decode + batching policy (std)
crates/pathland-render-gtk/ # RENDERER — host reader (RenderTree) + maps opcode frames onto
                          #   native GTK widgets incrementally; the only crate that touches
                          #   GTK/glib/pango. Exposes pathland_gtk_run for Java (JNA) hosts.
# ── Retained-UI projection (host/driver surface) ──────────────────────────
crates/pathland-view-native/ # NATIVE C-ABI shim + NativeHost: flat world over a zero-copy
                          #   shared-memory ring, for Swift/Java/C#/other native hosts
                          #   (cdylib name stays "pathland_native")
# ── Tool + demo ───────────────────────────────────────────────────────────
crates/pathland-codegen/  # DSL code generator: parses lib/ui/components.yaml, asserts every
                          #   id against pathland_core::constants, emits the checked-in
                          #   Java DSL (std bin crate)
crates/pathland-render-gtk-demo/ # Rust GTK4 demo: authors the DSL, emits into the ring, renders
                          #   through pathland-render-gtk. Uses NO GTK APIs directly.
lib/ui/components.yaml    # single source of truth for the DSL catalog (components,
                          #   per-component constructor props, global modifiers, enums, ids)
lib/java/pathland-demo/   # Java (Maven) demo: catalog-generated SwiftUI-like DSL + JNA over
                          #   pathland-view-native, rendered through pathland-render-gtk. No Swing, no GTK.
```

- Test: `cd lib/rust && cargo test` (runs all crates).
- Run the GTK demo (native, zero-copy shared ring): `cd lib/rust && cargo run -p pathland-render-gtk-demo`.
- Run the Java demo (JNA over the native C-ABI shim + GTK renderer):
  `cd lib/java/pathland-demo && ./run.sh` (or `./run.sh demo.DemoHeadless` for the
  headless verification). The script builds the native libs, compiles, and launches
  `java` directly — on macOS GTK must run on the process's main thread, so it passes
  `-XstartOnFirstThread` to `java` itself (`mvn exec:java` does not propagate the
  flag correctly).

### Native C-ABI shim (`pathland-view-native`)

The **desktop/cross-language zero-copy path**: a native `cdylib` exposing the
flat world (the flat `builder`/`engine` surface) as `pathland_native_*` C
functions, with a **shared-memory ring** the host driver reads in place. Any
language that links the dylib (Swift/Java/C# via FFI) calls the flat surface —
no per-component wrappers — and consumes opcodes zero-copy. The Java demo
(`lib/java/pathland-demo`) demonstrates this with a SwiftUI-like Java DSL over
JNA.

### GTK4 Renderer (`pathland-render-gtk`)

The desktop renderer: a single crate that owns **all** GTK/glib/pango usage and
maps opcode frames **incrementally** onto native GTK widgets (a retained
`id → gtk::Widget` map). Both the Rust demo and the Java demo render through
it — the demos **never call GTK or Swing directly**:

- Rust demo links `pathland-render-gtk` as an `rlib` and calls `GtkRenderer::run(...)`
  with a wake closure.
- Java demo loads `pathland-render-gtk` as a `cdylib` via JNA and calls
  `pathland_gtk_run(host, on_event)`; native inputs round-trip as `EVENT`
  opcodes through the shared ring. The renderer **writes** the events and
  **wakes** the host (no payload); the host drains the event ring itself via
  `pathland_native_drain_events` (Rust: `NativeHost::drain_events` /
  `RingTransport::drain_events`). Events are never delivered through a
  side-channel callback — they flow through the opcode engine.

The renderer maps native inputs onto the raw `Event` surface via GTK4
controllers (`Button::clicked` → pointer up, `EventControllerMotion` →
pointer move/enter/leave), emitting events through the same `Pump::send_input`
path.

`pathland_gtk::run` passes an explicit empty argv to GTK (the process command
line belongs to the embedding host — e.g. the JVM's `-cp`/`-D` flags — and must
not be parsed as GTK options).

### Catalog-Driven DSL (`lib/ui/components.yaml` + `pathland-codegen`)

The **single source of truth** for the DSL surface: components, per-component
constructor props, global modifiers, enums, and ids live in one YAML file. The
`pathland-codegen` generator parses it, **asserts every id against
`pathland_core::constants`** (a hard build error on mismatch — the consistency
safety net), and emits the checked-in Java DSL (typed enums, `View`/`DSL`/
`ComponentNode`/`Modified`, overloaded factories). Rules (NON-NEGOTIABLE):

- Component **constructor props** (structural/layout) are constructor args, never chainable.
- Global **modifiers** (appearance/decoration) are chainable on any view.
- `spacing` is a constructor property; `padding` is a modifier (always).
- No standalone width/height — use the compound `frame(width, height, alignment)` modifier.
- Typed enums (Align/TextAlign/Truncation/FontWeight), not raw ints.

Run `./generate.sh` (or `cargo run -p pathland-codegen`) to regenerate.

### POC Goals (issues #12–#18)

| # | Goal | Status |
|---|------|--------|
| 12 | 16-byte opcode engine | **Complete** |
| 13 | Core components & modifiers in Rust | **Complete** |
| 18 | Opcode transport layer (+ native C-ABI shim, zero-copy ring) | **Complete** |
| 16 | Rust desktop app with GTK4 renderer (native shared ring) | **Complete** |
| 15 | Quarkus SSR + WebSocket demo | Planned |

---

## Project Vision

**Pathland is a cross-platform, cross-language UI protocol** that enables retained-mode UI development with multiple renderer backends. It is **protocol-first**, meaning the protocol specification is the source of truth, not any particular implementation.

**Primary Goal**: Write once, run anywhere - Enable UI code to be written once and deployed across web, mobile, desktop, and embedded platforms through different renderer implementations.

**Status**: The Rust opcode engine (16-byte opcode, ring buffer, arena, diff-based reactive emission) is implemented and tested (`cargo test`). See the Architecture section above.

---

## CRITICAL ARCHITECTURAL PRINCIPLES

### Principle 1: Renderer Statelessness (NON-NEGOTIABLE)

> **The renderer MUST NOT retain application state.**

- Renderers are **pure functions** of the opcode stream: same opcodes → same output
- A renderer MAY retain its **rendered-output tree** (id → native element + computed layout) for drawing, hit-testing, and event routing — this is a cache of its own output, not state
- The renderer MUST NOT retain component property values as business state, application control flow, or anything the application can change without emitting an opcode
- The application owns the canonical retained UI tree
- The engine emits **deltas only**; the renderer applies them to its native elements

**Violation of this principle is a bug, not a feature.**

### Principle 2: Command-Based Protocol (NON-NEGOTIABLE)

> **The protocol transmits tree mutations as a stream of commands, NOT as serialized trees.**

- Each frame is a **batch of delta commands** describing changes
- Only **actual changes** are transmitted (diff-based reactive emission)
- Protocol acts like a **VM instruction stream** / ABI
- Deterministic, linear decoding without schema lookup or reflection

### Principle 3: Binary Protocol (NON-NEGOTIABLE)

> **The protocol MUST be binary.**

- Open-source, cross-platform binary format
- Fixed **16-byte instructions** in a ring buffer shared with the host via linear memory
- Custom instruction-based bytecode, not schema-driven serialization
- **Both directions are binary**: tree mutations (app → renderer) AND raw-input events (renderer → app) share the same instruction format, so the wire is language- and platform-agnostic

---

## Protocol Quick Reference

### Opcode Format

Every opcode is exactly 16 bytes:

```
[Category: u8][Command: u8][Flags: u16][A: u32][B: u32][C: u32]
```

See `spec/OPCODE.md` for the full format, ring buffer, arena, and frame lifecycle.

### Categories

| Category | Value | Direction | Description |
|----------|-------|-----------|-------------|
| TREE | 0x01 | Guest → Host | Node create/delete/insert/remove/move |
| STYLE | 0x02 | Guest → Host | Constraint properties (spacing, padding, …), design tokens |
| EVENT | 0x03 | Host → Guest | Raw inputs: pointer down/move/up, key down/up |
| META | 0x04 | Both | Reset, environment |

### Component Types (u16)

| Component | ID |
|-----------|----|
| HSTACK | 0x0001 |
| VSTACK | 0x0002 |
| TEXT | 0x0003 |
| BUTTON | 0x0004 |
| IMAGE | 0x0005 |
| SWITCH | 0x0006 |
| TEXT_FIELD | 0x0007 |
| SPACER | 0x0008 |
| SCROLLVIEW | 0x0009 |
| LIST | 0x000A |
| GRID | 0x000B |
| COMMENT | 0x000C |

### Key Property IDs

**Stack**: SPACING=0x0001, ALIGNMENT=0x0002, CONTENT_MARGINS=0x0005  
**Text**: TEXT=0x000A, TEXT_ALIGNMENT=0x000C, LINE_LIMIT=0x000B, TRUNCATION_MODE=0x000D  
**Style**: COLOR=0x100A, FONT_SIZE=0x1007, FONT_WEIGHT=0x1008, FONT_FAMILY=0x1009, BACKGROUND_COLOR=0x1001, BORDER_WIDTH=0x1003, BORDER_COLOR=0x1004, BORDER_RADIUS=0x1005, OPACITY=0x100D, VISIBLE=0x100E, Z_INDEX=0x100F, CLIPS_TO_BOUNDS=0x1010, PADDING=0x1011, PADDING_TOP/RIGHT/BOTTOM/LEFT=0x1012-0x1015  
**Special**: WIDTH=0x100B (use -1=FILL, -2=HUG_CONTENT), HEIGHT=0x100C  
**Semantic**: ROLE=0x2001, STATE=0x2002, ENABLED=0x2003, SELECTED=0x2004, EVENT_LISTENERS=0x2005 (u32 bitmask — which raw events a node wants reported)

### Colors

- Literal colors are **sRGB** with D65 white point, packed as `0xAARRGGBB`
- Semantic token resolution and theme adaptation are **renderer-owned**

### Design Token System

**Core Principle**: Application defines intent and overrides. Renderer defines visual appearance and behavior.

- Renderer owns design tokens, default values, semantic-token resolution, interaction states (hover, pressed, focus, disabled), and theme logic
- `SET_DESIGN_TOKEN` identifies tokens by **dot-separated string paths** (e.g. `color.primary`, `space.2`) with the standard value-type encoding — there is no separate numeric tokenId system
- The protocol MUST NEVER describe hover styles, click styles, visual transitions, conditional styling, or layout tuning for interaction states

Full details: [Design Token System](./spec/OPCODE.md#design-token-system).

---

## Implementation Guidelines

### Adding New Component
1. Add to `component_type` in `lib/rust/crates/pathland-core/src/constants.rs`
2. Document in `spec/OPCODE.md`
3. Implement the component type in `pathland-core` (if it affects the retained tree)
4. Implement native-element mapping in the target renderer (Goal 3–5)

### Adding New Property
1. Add to the appropriate property module in `constants.rs`
2. Document in `spec/OPCODE.md`
3. Handle the value type in `pathland-core`'s diff emission (if a stack/text/size property)
4. Implement in each renderer's property application

### Modifying Protocol
1. Update `spec/OPCODE.md` first (and `spec/CONFORMANCE.md` vectors)
2. Update `constants.rs` and `pathland-core` encoding/emitters
3. Verify backward compatibility; update `pathland-core`/`pathland-render-gtk` + tests

### Changing the Wire Format
- Bump the wire `version` field in `spec/OPCODE.md` and `pathland-core`'s header (currently 1). Pre-release format changes are acceptable while version stays 1.

---

## Common Pitfalls

### NEVER Do These
| Anti-Pattern | Why Wrong | Correct |
|--------------|-----------|---------|
| Renderer stores application state | Violates statelessness | Application owns the tree |
| Engine computes layout / emits rects | Violates declarative model | Emit structure + constraints; native elements lay out |
| Send full trees | Inefficient | Diff-based reactive emission |
| String property names | Larger payloads | Use numeric IDs |
| String component names | Larger payloads | Use numeric IDs |
| Generic RGB | Ambiguous | Explicitly sRGB |
| Hover styles in protocol | Renderer job | Define in theme |
| Heap allocation in steady-state emission | Slow | Preallocated snapshot slab + arena |

---

## Project Status

**Complete**: 16-byte opcode engine (`pathland-core`), SwiftUI-style view DSL with decoupled chainable modifiers (`pathland-view`), declarative diff-based reactive emission (`pathland-core`), host reader to a native-element description (`pathland-render-gtk`), opcode transport with network-batch encode/decode + time/size batching policy (`pathland-core-transport`), golden conformance vectors (incl. raw-input EVENT and network-batch bytes), typed raw-input event encode/decode, `no_std` builds, zero-alloc steady-state emission, the **bidirectional event ring** (host → guest EVENT opcodes in shared memory, drained by the host via a generic `pathland_native_drain_events` C ABI — the renderer only writes + wakes), the **GTK4 renderer** (`pathland-render-gtk`) with Rust + Java demos that render through it without touching GTK/Swing directly, the **catalog-driven DSL** (`lib/ui/components.yaml` + `pathland-codegen` → generated Java DSL), **`EVENT_LISTENERS`** (any element emits raw events via a u32 bitmask property), and **`onTapGesture`** (Rust + Java DSL modifier + app-side `TapRecognizer` over the raw pointer events). **Tests green across the workspace.**

**Planned / deferred**: signals (Goal 2/#13), Quarkus SSR + WebSocket demo (Goal 4/#15, a browser/remote projection that would reintroduce a WASM guest + WIT host path), host → guest events over the network transport (the ring carries them; the network batch wire format does not yet), TEXT_FIELD editing, image rendering.

---

## Quick Start

1. Read this file and `spec/OPCODE.md`
2. Run tests: `cd lib/rust && cargo test` (runs all crates)
3. Make small changes, verify they work

---

## Pathland Mindset

**Always remember**:
1. Protocol is King
2. Renderers are Dumb (execute commands only)
3. Applications are Smart (generate commands)
4. Only Changes Matter (transmit mutations / reactive emission)
5. Binary is Beautiful (efficient, deterministic)

**When in doubt**: Check `spec/OPCODE.md`, the conformance vectors in `spec/CONFORMANCE.md`, and the reference implementation (`pathland-core`). Ask: "Does this maintain stateless renderers?" "Does this only transmit actual changes?" "Does this describe WHAT the UI is, never WHERE?" "Is this representable as a 16-byte opcode in any language?"
