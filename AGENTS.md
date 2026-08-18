# Pathland Project - AI Agent Guide

This document provides essential context for AI agents (or human contributors) working on the **Pathland** protocol. It captures the project's direction, architectural decisions, and implementation details to ensure consistency.

**Last Updated**: August 14, 2026

---

## New Direction: Rust WASM Opcode Engine

> The canonical core is a **Rust engine compiled to WASM** ("WASM guest engine")
> that emits the application's **declarative view structure** — VStack, HStack,
> Text, spacing, padding, alignment — as a fixed **16-byte opcode ring buffer**
> into shared linear memory, consumed by host renderers. View components and
> modifiers are written in Rust with a SwiftUI-like API; other languages consume
> the components as **WASM/WIT** components.

### The 16-byte Opcode Engine

- Every opcode is exactly **16 bytes**: `Category (1B) | Command ID (1B) | Flags (2B) | A (4B) | B (4B) | C (4B)`, `#[repr(C, packed)]`, little-endian.
- A 64-byte cache line holds exactly **4 opcodes** → L1-cache-friendly.
- Opcodes live in a **ring buffer** in linear memory; the guest writes at `writeCursor`, the host reads from `readCursor`; frame boundaries via a monotonic `frameCount` in the header block.
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

### Rust Workspace (`lib/rust/`)

```
crates/pathland-opcode/   # 16-byte opcode, ring buffer, arena, memory layout (no_std)
crates/pathland-view/     # SwiftUI-style view DSL: VStack/HStack/Text + decoupled
                          #   modifiers (spacing/padding/fontSize/color/background) (no_std)
crates/pathland-engine/   # retained view tree -> declarative TREE/STYLE opcodes,
                          #   diff-based reactive emission (zero-alloc steady state)
crates/pathland-host/     # host reader: ring -> native-element description (std layer)
crates/pathland-transport/# opcode transport: shared-memory ring (existing) + network batch
                          #   encode/decode + batching policy (time/size) (std layer)
wit/pathland.wit          # WIT component-world definitions (Goal 3+)
```

- Test: `cd lib/rust && cargo test` (runs all crates).
- WASM build: `RUSTC=~/.rustup/toolchains/stable-aarch64-apple-darwin/bin/rustc cargo build --target wasm32-unknown-unknown`
  (the Homebrew `cargo` on PATH uses a rustc without the wasm std; use the rustup toolchain's rustc).

### POC Goals (issues #12–#18)

| # | Goal | Status |
|---|------|--------|
| 12 | 16-byte opcode engine | **Complete** |
| 13 | Core components & modifiers in Rust | **Complete** |
| 18 | Opcode transport layer (shared memory + network batch) | **In progress** |
| 16 | Rust desktop app with GTK4 renderer | Planned |
| 15 | Quarkus SSR + WebSocket demo | Planned |

---

## Project Vision

**Pathland is a cross-platform, cross-language UI protocol** that enables retained-mode UI development with multiple renderer backends. It is **protocol-first**, meaning the protocol specification is the source of truth, not any particular implementation.

**Primary Goal**: Write once, run anywhere - Enable UI code to be written once and deployed across web, mobile, desktop, and embedded platforms through different renderer implementations.

**Status**: The Rust WASM opcode engine (16-byte opcode, ring buffer, arena, diff-based reactive emission) is implemented and tested (`cargo test`). See the New Direction section above.

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

**Stack**: SPACING=0x0001, ALIGNMENT=0x0002, JUSTIFICATION=0x0003, PADDING=0x0004, CONTENT_MARGINS=0x0005  
**Text**: TEXT=0x000A, TEXT_ALIGNMENT=0x000C, LINE_LIMIT=0x000B, TRUNCATION_MODE=0x000D  
**Style**: COLOR=0x100A, FONT_SIZE=0x1007, FONT_WEIGHT=0x1008, FONT_FAMILY=0x1009, BACKGROUND_COLOR=0x1001, BORDER_WIDTH=0x1003, BORDER_COLOR=0x1004, BORDER_RADIUS=0x1005, OPACITY=0x100D, VISIBLE=0x100E, Z_INDEX=0x100F, CLIPS_TO_BOUNDS=0x1010, PADDING_TOP/RIGHT/BOTTOM/LEFT=0x1012-0x1015  
**Special**: WIDTH=0x100B (use -1=FILL, -2=HUG_CONTENT), HEIGHT=0x100C  
**Semantic**: ROLE=0x2001, STATE=0x2002, ENABLED=0x2003, SELECTED=0x2004

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
1. Add to `component_type` in `lib/rust/crates/pathland-opcode/src/constants.rs`
2. Document in `spec/OPCODE.md`
3. Implement the component type in `pathland-engine` (if it affects the retained tree)
4. Implement native-element mapping in the target renderer (Goal 3–5)

### Adding New Property
1. Add to the appropriate property module in `constants.rs`
2. Document in `spec/OPCODE.md`
3. Handle the value type in `pathland-engine`'s diff emission (if a stack/text/size property)
4. Implement in each renderer's property application

### Modifying Protocol
1. Update `spec/OPCODE.md` first (and `spec/CONFORMANCE.md` vectors)
2. Update `constants.rs` and `pathland-opcode` encoding/emitters
3. Verify backward compatibility; update `pathland-engine`/`pathland-host` + tests

### Changing the Wire Format
- Bump the wire `version` field in `spec/OPCODE.md` and `pathland-opcode`'s header (currently 1). Pre-release format changes are acceptable while version stays 1.

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

**Complete**: 16-byte opcode engine (`pathland-opcode`), SwiftUI-style view DSL with decoupled chainable modifiers (`pathland-view`), declarative diff-based reactive emission (`pathland-engine`), host reader to a native-element description (`pathland-host`), opcode transport with network-batch encode/decode + time/size batching policy (`pathland-transport`), golden conformance vectors (incl. raw-input EVENT and network-batch bytes), typed raw-input event encode/decode, `no_std` + wasm32 builds, zero-alloc steady-state emission. **55 unit tests green across 5 crates.**

**Planned / deferred**: signals (Goal 2/#13), Quarkus SSR + WebSocket demo (Goal 4/#15), GTK4 desktop renderer (Goal 5/#16), raw-input event routing into the guest engine, host → guest events over the network transport, TEXT_FIELD editing, image rendering.

---

## Quick Start

1. Read this file and `spec/OPCODE.md`
2. Run tests: `cd lib/rust && cargo test` (runs all crates)
3. Build for wasm32: `RUSTC=~/.rustup/toolchains/stable-aarch64-apple-darwin/bin/rustc cargo build --target wasm32-unknown-unknown`
4. Make small changes, verify they work

---

## Pathland Mindset

**Always remember**:
1. Protocol is King
2. Renderers are Dumb (execute commands only)
3. Applications are Smart (generate commands)
4. Only Changes Matter (transmit mutations / reactive emission)
5. Binary is Beautiful (efficient, deterministic)

**When in doubt**: Check `spec/OPCODE.md`, the conformance vectors in `spec/CONFORMANCE.md`, and the reference implementation (`pathland-opcode`). Ask: "Does this maintain stateless renderers?" "Does this only transmit actual changes?" "Does this describe WHAT the UI is, never WHERE?" "Is this representable as a 16-byte opcode in any language?"
