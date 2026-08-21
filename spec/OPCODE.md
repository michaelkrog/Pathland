# Pathland Opcode Protocol Specification

**Wire protocol version:** 1
**Status:** Draft
**Format:** Fixed-size (16-byte) opcode engine
**Last Updated:** August 13, 2026

---

## Overview

The Pathland Opcode Protocol is the **fixed-size instruction engine** at the heart of the Rust-first architecture. The **WASM guest engine** emits the application's **declarative view structure** — VStack, HStack, Text, spacing, padding, alignment — as a stream of fixed 16-byte opcodes into a **ring buffer** in **linear memory**. The host renderer consumes the ring and maps the structure onto that platform's **native elements** (GTK4 widgets, DOM elements, HTML).

**The engine does not compute layout and does not emit rects.** Native renderers lay out their own native elements from the constraint properties the engine passes through. This is the Pathland principle: *always render through that platform's native elements.*

This specification supersedes the historical variable-length binary instruction format (which has been removed from the repository).

### Goals

- **Sub-millisecond execution**: every opcode is a fixed 16 bytes; emission is a diff over the retained tree with **zero dynamic heap allocations** in the steady state.
- **L1 CPU cache alignment**: a 64-byte cache line holds exactly **4 opcodes**. Ring slots are 16-byte aligned and densely packed.
- **Reactive emission**: only the nodes that changed emit opcodes. An unchanged tree emits **zero** opcodes (see [Reactive Emission](#reactive-emission)).
- **Linear, deterministic decoding**: the host walks the ring with a single cursor.

### Core Principles

1. **Fixed-size instructions**: every opcode is exactly 16 bytes — no length prefixes, no skippable-variable framing.
2. **Declarative, not positioned**: the engine describes *what* the UI is (stacks, text, constraints), never *where* it is. Native elements compute their own positions.
3. **Numeric IDs**: categories, commands, component types, and properties are numeric.
4. **Native elements**: renderers map the opcode stream onto that platform's native elements — never a generic canvas unless a platform has no native equivalent.
5. **Zero-copy**: the ring and arena are plain regions of the same linear memory shared with the host.
6. **Single-producer / single-consumer**: the guest engine produces; the host renderer consumes. No locks required.

---

## Opcode Format

Every opcode is exactly **16 bytes**:

```
[Category: u8][Command: u8][Flags: u16][A: u32][B: u32][C: u32]
```

| Field | Size | Offset | Description |
|-------|------|--------|-------------|
| `Category` | 1B | 0 | Opcode category (see [Category Table](#category-table)) |
| `Command` | 1B | 1 | Command within the category (see [Command Tables](#command-tables)) |
| `Flags` | 2B | 2 | Category/command-specific flags |
| `A` | 4B | 4 | Primary payload |
| `B` | 4B | 8 | Secondary payload |
| `C` | 4B | 12 | Tertiary payload |

All multi-byte values are **little-endian**. The Rust reference type is `#[repr(C, packed)]`:

```rust
#[repr(C, packed)]
pub struct Opcode {
    pub category: u8,
    pub command: u8,
    pub flags: u16,
    pub a: u32,
    pub b: u32,
    pub c: u32,
}
```

`size_of::<Opcode>() == 16`.

### Payload encoding conventions

- **Float payloads** (`spacing`, `padding`, sizes) are stored as raw `f32` (IEEE 754) bit patterns in a `u32` field.
- **Node IDs** are `u32`.
- **Component types / property IDs** are `u16`; when packed into a 4-byte payload they occupy the low two bytes (the high bytes are reserved / zero unless documented).
- **Arena references** are a `u32` byte offset into the arena region (see [Arena](#arena)).
- **Colors** are packed `0xAARRGGBB` in sRGB (see [Colors](#colors)).

### Reserved ranges

- `Category == 0` is reserved (invalid).
- `Command == 0` in any category is reserved (invalid).
- `Category 0x80-0xFF`: custom/extended categories.

---

## Category Table

| Category | Value | Name | Producer | Description |
|----------|-------|------|----------|-------------|
| `TREE` | `0x01` | Tree mutations | Guest engine | Node create/delete/insert/remove/move |
| `STYLE` | `0x02` | Constraints & tokens | Guest engine | Property values (spacing, padding, …), design tokens |
| `EVENT` | `0x03` | Raw inputs | Host renderer | Pointer down/move/up, key down/up |
| `META` | `0x04` | Control | Both | Reset, environment |

---

## Command Tables

### TREE (0x01)

| Command | Value | A | B | C | Flags | Description |
|---------|-------|---|---|---|-------|-------------|
| `CREATE_NODE` | `0x01` | nodeId | componentType (u16, low) | 0 | — | Create a node of `componentType` |
| `DELETE_NODE` | `0x02` | nodeId | 0 | 0 | — | Delete a node and its subtree |
| `INSERT_CHILD` | `0x03` | parentId | childId | index | `0x0001` = append | Insert `childId` into `parentId` at `index` |
| `REMOVE_CHILD` | `0x04` | parentId | childId | 0 | — | Remove `childId` from `parentId` |
| `MOVE_CHILD` | `0x05` | parentId | childId | newIndex | `0x0001` = append | Move child to `newIndex` (after removal) |

### STYLE (0x02)

The engine does not emit positions. `STYLE` carries the **constraint properties**
that native renderers feed to their own layout — spacing, alignment, FILL/HUG
size hints — plus **styling modifiers** (padding, colors, fonts, borders).

| Command | Value | A | B | C | Flags | Description |
|---------|-------|---|---|---|-------|-------------|
| `SET_PROPERTY` | `0x01` | nodeId | propertyId (u16, low) + valueType (u8, high byte) | value | — | Set a constraint/style property; `value` depends on `valueType` |
| `SET_DESIGN_TOKEN` | `0x02` | arenaRef (path) | valueType (u8) | value | — | Override a design token; path is an arena string |
| `SET_TEXT` | `0x03` | nodeId | arenaRef (utf8) | 0 | — | Set a node's text content |

`SET_PROPERTY` encodes the value type in the **high byte of `B`** (bits 24–31) and the property id in the low two bytes:

```
B = (valueType << 16) | propertyId
```

#### Value types

| Value Type | Value | C / value encoding |
|------------|-------|--------------------|
| `U8` | `0x01` | low byte of C |
| `U32` | `0x02` | u32 |
| `I32` | `0x03` | i32 |
| `F32` | `0x04` | f32 |
| `STRING` | `0x05` | arenaRef (utf8) |
| `ENUM` | `0x06` | low byte of C |
| `COLOR` | `0x07` | packed `0xAARRGGBB` |
| `DESIGN_TOKEN` | `0x08` | arenaRef (token path) |

#### Constraint properties for native layout

The following properties drive native layout; the renderer maps them to its
native equivalents (e.g. `SPACING` → GTK box spacing / CSS `gap`, `WIDTH`/`HEIGHT`
→ size requests). Special `WIDTH`/`HEIGHT` values: `-1` = FILL (expand to
available), `-2` = HUG_CONTENT (native intrinsic size).

| Property | Value | Type | Native meaning |
|----------|-------|------|----------------|
| `SPACING` | `0x0001` | F32 | Gap between children |
| `ALIGNMENT` | `0x0002` | ENUM | Cross-axis alignment |
| `WIDTH` | `0x100B` | F32 | Width hint (-1 FILL, -2 HUG) |
| `HEIGHT` | `0x100C` | F32 | Height hint (-1 FILL, -2 HUG) |

#### Styling properties (modifiers)

Styling properties are **modifiers** — they apply to any view, not just stacks —
and map to visual decoration rather than layout. `PADDING` (uniform) and its
per-edge variants map to widget margins / CSS `padding`, alongside
`COLOR`/`BACKGROUND_COLOR`/`BORDER_*`:

| Property | Value | Type | Native meaning |
|----------|-------|------|----------------|
| `PADDING` | `0x1011` | F32 | Uniform inner padding (any view) |
| `PADDING_TOP` | `0x1012` | F32 | Top padding |
| `PADDING_RIGHT` | `0x1013` | F32 | Right padding |
| `PADDING_BOTTOM` | `0x1014` | F32 | Bottom padding |
| `PADDING_LEFT` | `0x1015` | F32 | Left padding |

Full property catalog: see the Rust `constants.rs` (carried forward from the
historical protocol).

### EVENT (0x03) — host → guest

Events are the **raw inputs**: the renderer reports what happened (a pointer
went down/moved/up, a key went down/up) and resolves which node it hit via its
own rendered-output tree. High-level interpretations — tap, drag, long-press —
are built by the guest/app from these raw inputs and are **not** part of the
protocol.

| Command | Value | A | B | C | Flags | Description |
|---------|-------|---|---|---|-------|-------------|
| `POINTER_DOWN` | `0x01` | targetId | x (f32) | y (f32) | `POINTER_SECONDARY` | Pointer button pressed at viewport-relative point |
| `POINTER_MOVE` | `0x02` | targetId | x (f32) | y (f32) | `HOVER_ENTER` / `HOVER_LEAVE` | Pointer moved (bit 0 = entered/hovering, bit 1 = leaving) |
| `POINTER_UP` | `0x03` | targetId | x (f32) | y (f32) | `POINTER_SECONDARY` | Pointer button released at viewport-relative point |
| `KEY_DOWN` | `0x04` | targetId | keyCode (u16, low) | modifiers (u8, low) | `KEY_REPEAT` | Key pressed (bit 1 = auto-repeat) |
| `KEY_UP` | `0x05` | targetId | keyCode (u16, low) | modifiers (u8, low) | — | Key released |

### META (0x04)

| Command | Value | A | B | C | Description |
|---------|-------|---|---|---|-------------|
| `RESET` | `0x01` | 0 | 0 | 0 | Host must clear all rendered output |
| `ENVIRONMENT` | `0x02` | viewportWidth (f32) | viewportHeight (f32) | 0 | Viewport size in logical points (host → guest) |

---

## Reactive Emission

The engine emits **only what changed** relative to its previous emission:

- **Property diff**: a changed `spacing`/`padding`/`WIDTH`/`HEIGHT`/`ALIGNMENT`/
  text emits a single `SET_PROPERTY` / `SET_TEXT` for that node. (Padding is a
  styling modifier, but it still diffs and emits like any other property.)
- **Structural diff**: a node added/removed/moved emits the corresponding
  `TREE` opcode(s).
- **Steady state**: an unchanged tree emits **zero** opcodes.

The **`frame` compound modifier** (width/height/alignment) is not a distinct
protocol concept: it emits `WIDTH`/`HEIGHT`/`ALIGNMENT` as ordinary
`STYLE:SET_PROPERTY` deltas, exactly like any other constraint property. There
is no `frame` opcode or dedicated wire type.

Signals in the application drive this: a signal marks the tree dirty; the
engine's next `emit` reconciles and writes only the delta. The renderer applies
each frame as a delta to its native elements.

---

## Linear Memory Layout

The guest engine and host share a **single linear memory**. Regions are fixed at module start:

```
+───────────────────────────────────────────────────────────────+
| 0x0000  Header block (64 B)  — cursors, frame counter, layout  |
| 0x0040  Ring buffer (16 B × slotCount)   [guest → host]        |
| ...      (slots densely packed, 64-byte aligned base)          |
| 0x10040 Event ring buffer (16 B × slotCount) [host → guest]    |
| ...                                                           |
| 0x20040 Arena (bump region for strings / token paths / lists)  |
| ...                                                            |
+───────────────────────────────────────────────────────────────+
```

> The event ring is the **host → guest** direction of the shared-memory
> transport: the renderer writes `EVENT`-category opcodes here and the
> guest/app drains them. It uses the same 16-byte slot layout as the main
> (guest → host) ring; both share `slotCount` (same capacity).

### Header block (64 bytes)

| Offset | Size | Field | Producer | Description |
|--------|------|-------|----------|-------------|
| 0x00 | 4 | `magic` | — | `0x504C504C` (`PLPL`) |
| 0x04 | 2 | `version` | — | Wire protocol version (1) |
| 0x06 | 4 | `ringOffset` | — | Byte offset of the ring region |
| 0x0A | 4 | `ringBytes` | — | Byte length of the ring region |
| 0x0E | 4 | `slotCount` | — | Number of ring slots (power of two) |
| 0x12 | 4 | `arenaOffset` | — | Byte offset of the arena region |
| 0x16 | 4 | `arenaBytes` | — | Byte length of the arena region |
| 0x1A | 4 | `arenaCursor` | guest | Next free byte in the arena |
| 0x1E | 4 | `readCursor` | host | Ring slot the host has consumed up to |
| 0x22 | 4 | `writeCursor` | guest | Ring slot the guest has written up to |
| 0x26 | 4 | `frameCount` | guest | Monotonic completed-frame counter |
| 0x2A | 4 | `eventRingOffset` | — | Byte offset of the host→guest event ring region |
| 0x2E | 4 | `eventRingBytes` | — | Byte length of the event ring region |
| 0x32 | 4 | `eventSlotCount` | — | Event ring slot count (power of two; = `slotCount`) |
| 0x36 | 4 | `eventReadCursor` | guest | Event ring slot the guest has consumed up to |
| 0x3A | 4 | `eventWriteCursor` | host | Event ring slot the host has written up to |
| 0x3E | 2 | reserved | — | Zero |

### Ring buffer

- Contiguous array of **16-byte slots**; `slotCount` is a **power of two** (wrap via mask, no modulo).
- **Producer** (guest) writes at `writeCursor`, then advances `writeCursor` and increments `frameCount` at frame end.
- **Consumer** (host) reads from `readCursor` up to `writeCursor`; after draining a frame it advances `readCursor`.
- **Backpressure**: the producer must not advance `writeCursor` past `readCursor` (ring full). The producer SHOULD flush a frame before the ring is full.
- **Frame boundary detection**: the host watches `frameCount`. When it advances, exactly one frame (all slots from the previously consumed `readCursor` to the current `writeCursor`) is complete.

### Event ring (host → guest)

- The **host** (renderer) is the producer: it writes `EVENT`-category opcodes at `eventWriteCursor`.
- The **guest** (app/engine) is the consumer: it reads from `eventReadCursor` up to `eventWriteCursor`, then advances `eventReadCursor`.
- Events are raw inputs and are consumed as soon as they are written (no frame batching); `eventFrameCount` is not required.
- Backpressure mirrors the main ring: the host must not advance `eventWriteCursor` past `eventReadCursor`.

### Arena

- A pre-allocated **bump region** for variable-length data (strings, token paths).
- Every arena entry is **self-describing**: `[u32 byteLength][bytes...]`.
- Opcodes reference entries by their **byte offset** (`arenaRef`), so an entry's length is read directly from the arena — all opcodes stay 16 bytes.
- The guest advances `arenaCursor` monotonically (no free-list, no fragmentation). The arena MAY be reset via `META::RESET`.

---

## Colors

Literal colors are **sRGB** (IEC 61966-2-1, D65 white point), packed as `0xAARRGGBB`:

- `AA`: alpha (0x00 transparent – 0xFF opaque)
- `RR`: red, `GG`: green, `BB`: blue

Stored little-endian in a `u32` payload. Semantic token resolution and theme adaptation remain **renderer-owned** (see [Design Token System](#design-token-system)).

---

## Design Token System

### Core Principle

> **The renderer owns the defaults. The application owns the overrides.**

This ensures a native look-and-feel by default and cross-platform consistency when the application overrides tokens.

### Responsibilities

| Aspect | Owner | Responsibility |
|--------|-------|----------------|
| **Default Token Values** | Renderer | Define platform-appropriate defaults for all standard tokens |
| **Token Overrides** | Application | Specify overrides for cross-platform consistency |
| **Token Resolution** | Renderer | Resolve final token values (override or default) |
| **Platform Adaptation** | Renderer | Adapt default token values to platform conventions |

### Token Identification

Tokens are identified by **dot-separated string paths** (e.g. `color.primary`, `space.2`, `font.body`), case-sensitive, lowercase recommended. The `DESIGN_TOKEN` value type (`0x08`) references a token path stored in the arena; `SET_DESIGN_TOKEN` overrides a token's value globally.

### Token Resolution Algorithm

```
FUNCTION resolveToken(tokenPath: string) -> PropertyValue:
    IF applicationOverrides.has(tokenPath):
        RETURN applicationOverrides[tokenPath]
    ELSE IF rendererDefaults.has(tokenPath):
        RETURN rendererDefaults[tokenPath]
    ELSE IF hasParentToken(tokenPath):
        RETURN resolveToken(getParentPath(tokenPath))
    ELSE:
        RETURN getFallbackValue(tokenPath)
```

### Renderer Responsibilities

The renderer MUST:

1. Provide platform-appropriate defaults for all standard tokens (e.g. `color.primary`, `font.body.size`, `space.md`).
2. Accept `SET_DESIGN_TOKEN` commands and store overrides.
3. Resolve design-token references in properties.
4. Fall back to defaults when no override exists.
5. Never transmit visual styling rules in the protocol.

The application MAY override any token via `SET_DESIGN_TOKEN` and reference tokens via the `DESIGN_TOKEN` value type; it MUST NOT assume specific default token values.

### Standard Token Catalog

Required core tokens (renderer MUST support with platform-appropriate defaults): `color.primary`, `color.secondary`, `color.background`, `color.surface`, `color.text.primary`, `color.text.secondary`, `color.border`, `font.body.size`, `font.body.weight`, `font.body.family`, `space.xs`–`space.lg`.

Recommended extended tokens: `color.success`, `color.warning`, `color.danger`, `color.info`, `font.heading.1`–`font.heading.6`, `font.size.heading.1`–`6`, `radius.sm`/`md`, `elevation.low`/`high`, `opacity.disabled`.

---

## Frame Lifecycle

A frame is a batch of delta opcodes produced by one `emit` pass:

1. Guest begins a frame.
2. Guest emits the delta opcodes (tree structure and/or property changes) into consecutive ring slots.
3. Guest allocates strings in the arena as needed.
4. Guest `end_frame()`: publishes `writeCursor`, then increments `frameCount`.
5. Host observes `frameCount` change, drains `[readCursor, writeCursor)`, advances `readCursor`.

Because the ring and arena are plain memory, the guest publishes via a single release store of `frameCount`; the host acquires on read.

---

## Transport

The opcode protocol is transport-agnostic. Two peer backends carry frames from
producer (guest engine) to consumer (host renderer):

| Backend | Scenario | Mechanism |
|---------|----------|-----------|
| Shared memory | Desktop / native (guest + host share linear memory) | The ring buffer + arena above; zero-copy |
| Network batch | SSR → browser (guest and host do **not** share memory) | Serialized batches of opcodes + arena delta |

The `Frame` type is the **transport seam**: a consumer (renderer) applies a
frame the same way whether it came from the shared-memory ring or a decoded
network batch.

### Network batch format

```
[u32 magic "PLPL"] [u16 version] [u16 flags] [u32 frameCount] [u32 opcodeCount]
[opcode × opcodeCount (16 B each)]
[u32 arenaDeltaLen] [arena delta bytes]
```

- **magic / version**: `0x504C504C` (`PLPL`, little-endian on the wire) / `1`.
  A decoder MUST reject batches with a mismatched magic or version.
- **flags**: direction. `0x0000` = guest → host (tree/style). Bit `0x0001` is
  reserved for host → guest (raw-input events), not yet implemented.
- **frameCount**: the guest frame counter of the batch's first frame (opcodes
  from multiple frames may coalesce into one batch; they remain in order).
- **arena delta**: the bytes appended to the bump arena since the previous
  batch. The consumer keeps a **mirrored arena** and appends each delta, so
  absolute `arenaRef` offsets stay valid — identical to shared memory.
- **META::RESET**: a batch containing a reset opcode clears the consumer's
  mirrored arena before appending (offsets restart at 0).

### Batching policy

The producer buffers opcodes and flushes a batch when **either** threshold is
reached (first trigger wins):

- **Time**: the interval since the first buffered opcode elapses (default **4 ms**).
- **Size**: the accumulated batch reaches a network-frame size (default **1400 bytes**).

Both thresholds are configurable; a producer MAY flush eagerly (e.g. on the
first frame after connection).

---

## Conformance

Golden byte vectors for this protocol are in [CONFORMANCE.md](./CONFORMANCE.md).
