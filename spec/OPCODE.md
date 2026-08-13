# Pathland Opcode Protocol Specification

**Wire protocol version:** 1
**Status:** Draft
**Format:** Fixed-size (16-byte) opcode engine
**Last Updated:** August 13, 2026

---

## Overview

The Pathland Opcode Protocol is the **fixed-size instruction engine** at the heart of the Rust-first architecture. All layout math, tree bounds, and drawing instructions are emitted by the **WASM guest engine** into a contiguous, fixed 16-byte opcode ring buffer in **linear memory**. The host renderer consumes the ring and draws.

This specification supersedes the variable-length format documented in [BINARY_PROTOCOL.md](./BINARY_PROTOCOL.md) (kept for history).

### Goals

- **Sub-millisecond execution**: every opcode is a fixed 16 bytes; no dynamic heap allocation during layout updates.
- **L1 CPU cache alignment**: a 64-byte cache line holds exactly **4 opcodes**. Ring slots are 16-byte aligned and densely packed.
- **Zero dynamic heap allocations** during layout: strings and other variable-length data live in a pre-allocated **bump arena**, referenced by offset.
- **Linear, deterministic decoding**: the host walks the ring with a single cursor.

### Core Principles

1. **Fixed-size instructions**: every opcode is exactly 16 bytes — no length prefixes, no skippable-variable framing.
2. **Numeric IDs**: categories, commands, component types, and properties are numeric.
3. **Renderer-agnostic**: the ring carries layout/bounds/draw/event data only — never renderer styling rules.
4. **Zero-copy**: the ring and arena are plain regions of the same linear memory shared with the host.
5. **Single-producer / single-consumer**: the guest engine produces; the host renderer consumes. No locks required.

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

- **Float payloads** (`x`, `y`, `width`, `height`, etc.) are stored as raw `f32` (IEEE 754) bit patterns in a `u32` field.
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
| `LAYOUT` | `0x02` | Layout results | Guest engine | Node origins and sizes |
| `STYLE` | `0x03` | Properties & tokens | Guest engine | Property values, design tokens |
| `DRAW` | `0x04` | Draw primitives | Guest engine | Rects, glyph runs (renderer hints) |
| `EVENT` | `0x05` | Discrete events | Host renderer | Tap, hover, key, etc. |
| `GESTURE` | `0x06` | Gesture updates | Host renderer | Began/changed/ended/cancelled |
| `META` | `0x07` | Control | Both | Reset, environment, custom data |

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

### LAYOUT (0x02)

| Command | Value | A | B | C | Description |
|---------|-------|---|---|---|-------------|
| `SET_ORIGIN` | `0x01` | nodeId | x (f32) | y (f32) | Top-left of the node in logical points |
| `SET_SIZE` | `0x02` | nodeId | width (f32) | height (f32) | Size of the node in logical points |

Bounds are split into two opcodes so that every opcode is exactly 16 bytes while retaining full `f32` precision.

### STYLE (0x03)

| Command | Value | A | B | C | Flags | Description |
|---------|-------|---|---|---|-------|-------------|
| `SET_PROPERTY` | `0x01` | nodeId | propertyId (u16, low) + valueType (u8, high byte) | value | — | Set a property; `value` encoding depends on `valueType` |
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

### DRAW (0x04)

| Command | Value | A | B | C | Description |
|---------|-------|---|---|---|-------------|
| `RECT` | `0x01` | nodeId | width (f32) | height (f32) | Fill/border rect for `nodeId` (origin = node origin) |
| `GLYPH_RUN` | `0x02` | nodeId | arenaRef (utf8) | 0 | Text glyph run for `nodeId` (layout supplies positions) |

### EVENT (0x05) — host → guest

| Command | Value | A | B | C | Description |
|---------|-------|---|---|---|-------------|
| `TAP` | `0x01` | targetId | x (f32) | y (f32) | Tap at viewport-relative point |
| `HOVER` | `0x02` | targetId | x (f32) | y (f32) | Pointer moved; Flags bit 0 = isHovering |
| `KEY` | `0x03` | targetId | keyCode (u16, low) | modifiers (u8, low) | Key event; Flags bit 0 = down, bit 1 = repeat |

### GESTURE (0x06) — host → guest

| Command | Value | A | B | C | Flags | Description |
|---------|-------|---|---|---|-------|-------------|
| `UPDATE` | `0x01` | targetId | gestureType (u8) + state (u8, high byte) | gestureId | — | Gesture lifecycle update |

### META (0x07)

| Command | Value | A | B | C | Description |
|---------|-------|---|---|---|-------------|
| `RESET` | `0x01` | 0 | 0 | 0 | Host must clear all rendered output |
| `ENVIRONMENT` | `0x02` | viewportWidth (f32) | viewportHeight (f32) | 0 | Viewport size in logical points (host → guest) |

---

## Linear Memory Layout

The guest engine and host share a **single linear memory**. Regions are fixed at module start:

```
+───────────────────────────────────────────────────────────────+
| 0x0000  Header block (64 B)  — cursors, frame counter, layout  |
| 0x0040  Ring buffer (16 B × slotCount)                         |
| ...      (slots densely packed, 64-byte aligned base)          |
| 0x10040 Arena (bump region for strings / token paths / lists)  |
| ...                                                            |
+───────────────────────────────────────────────────────────────+
```

### Header block (64 bytes)

| Offset | Size | Field | Producer | Description |
|--------|------|-------|----------|-------------|
| 0x00 | 4 | `magic` | — | `0x504C504C` (`PLPL`) |
| 0x04 | 2 | `version` | — | Wire protocol version (1) |
| 0x06 | 4 | `ringOffset` | — | Byte offset of the ring region |
| 0x0A | 4 | `ringBytes` | — | Byte length of the ring region |
| 0x0E | 4 | `slotCount` | — | Number of ring slots (power of two) |
| 0x12 | 4 | `arenaOffset` | — | Byte offset of the arena region |
| 0x14 | 4 | `arenaBytes` | — | Byte length of the arena region |
| 0x18 | 4 | `arenaCursor` | guest | Next free byte in the arena |
| 0x1C | 4 | `readCursor` | host | Ring slot the host has consumed up to |
| 0x20 | 4 | `writeCursor` | guest | Ring slot the guest has written up to |
| 0x24 | 4 | `frameCount` | guest | Monotonic completed-frame counter |
| 0x28 | 36 | reserved | — | Zero |

### Ring buffer

- Contiguous array of **16-byte slots**; `slotCount` is a **power of two** (wrap via mask, no modulo).
- **Producer** (guest) writes at `writeCursor`, then advances `writeCursor` and increments `frameCount` at frame end.
- **Consumer** (host) reads from `readCursor` up to `writeCursor`; after draining a frame it advances `readCursor`.
- **Backpressure**: the producer must not advance `writeCursor` past `readCursor` (ring full). The producer SHOULD flush a frame before the ring is full.
- **Frame boundary detection**: the host watches `frameCount`. When it advances, exactly one frame (all slots from the previously consumed `readCursor` to the current `writeCursor`) is complete.

### Arena

- A pre-allocated **bump region** for variable-length data (strings, token paths, child-id lists, glyph runs).
- Every arena entry is **self-describing**: `[u32 byteLength][bytes...]`.
- Opcodes reference entries by their **byte offset** (`arenaRef`), so an entry's length is read directly from the arena — all opcodes stay 16 bytes.
- The guest advances `arenaCursor` monotonically (no free-list, no fragmentation). The arena MAY be reset via `META::RESET`.

---

## Colors

Literal colors are **sRGB** (IEC 61966-2-1, D65 white point), packed as `0xAARRGGBB`:

- `AA`: alpha (0x00 transparent – 0xFF opaque)
- `RR`: red, `GG`: green, `BB`: blue

Stored little-endian in a `u32` payload. Semantic token resolution and theme adaptation remain **renderer-owned** (see [Design Token System](./BINARY_PROTOCOL.md#design-token-system) for the historical principles, carried forward unchanged).

---

## Frame Lifecycle

A frame is a batch of opcodes produced by one layout/paint pass:

1. Guest begins a frame (optionally flushing/resetting cursor state).
2. Guest emits opcodes into consecutive ring slots (tree, layout, style, draw).
3. Guest allocates strings in the arena as needed.
4. Guest `end_frame()`: publishes `writeCursor`, then increments `frameCount`.
5. Host observes `frameCount` change, drains `[readCursor, writeCursor)`, advances `readCursor`.

Because the ring and arena are plain memory, the guest publishes via a single release store of `frameCount`; the host acquires on read.

---

## Conformance

Golden byte vectors for this protocol are in [CONFORMANCE.md](./CONFORMANCE.md).
