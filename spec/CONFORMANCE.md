# Pathland Conformance Test Vectors

**Wire protocol version:** 1
**Encoding:** little-endian
**Opcode size:** 16 bytes

This document provides **golden byte arrays** for the Pathland opcode protocol (see [OPCODE.md](./OPCODE.md)). A conforming implementation MUST:

- encode each opcode to exactly these 16 bytes, and
- decode these bytes to the equivalent opcode.

The vectors are enforced by the reference Rust encoder (`pathland-core`,
`crates/pathland-core/src/conformance.rs`).

Companion catalogs: [PRIMITIVES.md](./PRIMITIVES.md) (views), [MODIFIERS.md](./MODIFIERS.md)
(modifiers/properties), [EVENTS.md](./EVENTS.md) (events), [TOKENS.md](./TOKENS.md)
(design tokens / theming). New IDs allocated there must gain vectors before
implementations depend on them.

## Opcode Layout

```
[Category: u8][Command: u8][Flags: u16][A: u32][B: u32][C: u32]
```

All multi-byte fields little-endian. `A`/`B`/`C` may carry `f32` bit patterns.

## Vectors

### 1. TREE:CREATE_NODE (id=1, VSTACK=0x0010)

```
01 01 00 00 01 00 00 00 10 00 00 00 00 00 00 00
```

- `01` category = TREE
- `01` command = CREATE_NODE
- `00 00` flags = 0
- `01 00 00 00` A = nodeId = 1
- `10 00 00 00` B = componentType = 0x0010 (VSTACK)
- `00 00 00 00` C = 0

### 2. TREE:INSERT_CHILD (parent=0, child=1, index=APPEND)

```
01 03 00 00 00 00 00 00 01 00 00 00 FF FF FF FF
```

- `01` category = TREE
- `03` command = INSERT_CHILD
- `00 00` flags = 0
- `00 00 00 00` A = parentId = 0
- `01 00 00 00` B = childId = 1
- `FF FF FF FF` C = APPEND (`u32::MAX`)

### 3. TREE:MOVE_CHILD (parent=1, child=2, newIndex=0)

```
01 05 00 00 01 00 00 00 02 00 00 00 00 00 00 00
```

- `01` category = TREE
- `05` command = MOVE_CHILD
- `00 00` flags = 0
- `01 00 00 00` A = parentId = 1
- `02 00 00 00` B = childId = 2
- `00 00 00 00` C = newIndex = 0

### 4. STYLE:SET_PROPERTY (id=1, propertyId=SPACING=0x0001, valueType=F32, 4.0)

```
02 01 00 00 01 00 00 00 01 00 04 00 00 00 80 40
```

- `02` category = STYLE
- `01` command = SET_PROPERTY
- `00 00` flags = 0
- `01 00 00 00` A = nodeId = 1
- `01 00 04 00` B = `(valueType << 16) | propertyId` = `(0x04 << 16) | 0x0001`
  - low two bytes `01 00` = propertyId = 0x0001 (SPACING)
  - high byte `04` = valueType = 0x04 (F32)
- `00 00 80 40` C = 4.0 (f32 LE: 0x40800000)

### 5. STYLE:SET_PROPERTY (id=1, propertyId=COLOR=0x100A, valueType=COLOR=0x07, rgba=0xFF0000FF)

```
02 01 00 00 01 00 00 00 0A 10 07 00 FF 00 00 FF
```

- `02` category = STYLE
- `01` command = SET_PROPERTY
- `00 00` flags = 0
- `01 00 00 00` A = nodeId = 1
- `0A 10 07 00` B = `(valueType << 16) | propertyId` = `(0x07 << 16) | 0x100A`
  - low two bytes `0A 10` = propertyId = 0x100A (COLOR)
  - high byte `07` = valueType = 0x07 (COLOR)
- `FF 00 00 FF` C = 0xFF0000FF (opaque blue, `0xAARRGGBB`)

### 6. STYLE:SET_TEXT (id=1, arenaRef=0)

```
02 03 00 00 01 00 00 00 00 00 00 00 00 00 00 00
```

- `02` category = STYLE
- `03` command = SET_TEXT
- `00 00` flags = 0
- `01 00 00 00` A = nodeId = 1
- `00 00 00 00` B = arenaRef = 0 (entry is `[u32 length][bytes]` in the arena)
- `00 00 00 00` C = 0

### 7. META:RESET

```
04 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00
```

- `04` category = META
- `01` command = RESET
- `00 00` flags = 0
- `00 00 00 00` A = 0
- `00 00 00 00` B = 0
- `00 00 00 00` C = 0

### 8. EVENT:POINTER_DOWN (target=5, x=10.0, y=20.0)

```
03 01 00 00 05 00 00 00 00 00 20 41 00 00 A0 41
```

- `03` category = EVENT
- `01` command = POINTER_DOWN
- `00 00` flags = 0
- `05 00 00 00` A = targetId = 5
- `00 00 20 41` B = 10.0 (f32 LE: 0x41200000)
- `00 00 A0 41` C = 20.0 (f32 LE: 0x41A00000)

### 9. EVENT:POINTER_MOVE (target=5, x=10.0, y=20.0, hovering)

```
03 02 01 00 05 00 00 00 00 00 20 41 00 00 A0 41
```

- `03` category = EVENT
- `02` command = POINTER_MOVE
- `01 00` flags = 0x0001 (`HOVER_ENTER`)
- `05 00 00 00` A = targetId = 5
- `00 00 20 41` B = 10.0 (f32 LE: 0x41200000)
- `00 00 A0 41` C = 20.0 (f32 LE: 0x41A00000)

### 10. EVENT:POINTER_UP (target=5, x=10.0, y=20.0)

```
03 03 00 00 05 00 00 00 00 00 20 41 00 00 A0 41
```

- `03` category = EVENT
- `03` command = POINTER_UP
- `00 00` flags = 0
- `05 00 00 00` A = targetId = 5
- `00 00 20 41` B = 10.0 (f32 LE: 0x41200000)
- `00 00 A0 41` C = 20.0 (f32 LE: 0x41A00000)

### 11. EVENT:KEY_DOWN (target=5, keyCode='A'=0x41, modifiers=0x01, repeat)

```
03 04 02 00 05 00 00 00 41 00 00 00 01 00 00 00
```

- `03` category = EVENT
- `04` command = KEY_DOWN
- `02 00` flags = 0x0002 (`KEY_REPEAT`)
- `05 00 00 00` A = targetId = 5
- `41 00 00 00` B = keyCode = 0x41 (`'A'`, low u16)
- `01 00 00 00` C = modifiers = 0x01 (low u8)

### 12. EVENT:KEY_UP (target=5, keyCode='A'=0x41, modifiers=0x01)

```
03 05 00 00 05 00 00 00 41 00 00 00 01 00 00 00
```

- `03` category = EVENT
- `05` command = KEY_UP
- `00 00` flags = 0
- `05 00 00 00` A = targetId = 5
- `41 00 00 00` B = keyCode = 0x41 (`'A'`, low u16)
- `01 00 00 00` C = modifiers = 0x01 (low u8)

### 13. META:RESYNC

```
04 03 00 00 00 00 00 00 00 00 00 00 00 00 00 00
```

- `04` category = META
- `03` command = RESYNC (host → guest: request a full snapshot)
- `00 00` flags = 0
- `00 00 00 00` A = 0
- `00 00 00 00` B = 0
- `00 00 00 00` C = 0

---

## Directions

- `TREE` / `STYLE` are **guest → host** (application → renderer).
- `EVENT` is **host → guest** (renderer → application): raw pointer/keyboard
  inputs with a host-resolved `targetId`. A conforming EVENT encoder/decoder
  MUST reproduce vectors 8–12 exactly.
- `META` is both directions.

## Frame Conformance

A complete frame is: delta opcodes written into consecutive ring slots, then a
`frameCount` increment in the header block. Ring slot `i` occupies bytes
`[ringOffset + i*16, ringOffset + i*16 + 16)`.

The header block layout and ring semantics are defined in [OPCODE.md](./OPCODE.md#linear-memory-layout).

The host → guest event ring shares the same 16-byte slot format and lives at
`eventRingOffset` (header `0x2A`), with `eventReadCursor` (0x36, guest-owned)
and `eventWriteCursor` (0x3A, host-owned). A host writing `EVENT:POINTER_UP`
into the event ring must reproduce the exact vector-11 bytes in the slot at
`eventWriteCursor`, then advance `eventWriteCursor`; the guest advances
`eventReadCursor` after draining.

String-bearing events (`TEXT_CHANGED`) resolve their text from the host → guest
**event arena** (header `eventArenaOffset` 0x40 / `eventArenaCursor` 0x48,
host-owned, shared memory) or the batch's string section (network) — the same
dual absolute/relative convention as `STYLE::SET_TEXT`. See OPCODE.md's
[event arena](./OPCODE.md#event-arena-host--guest) section.

## Network Batch Conformance

A network batch serializes opcodes + an arena delta (see
[OPCODE.md](./OPCODE.md#transport)). A conforming batch encoder/decoder MUST
reproduce the following bytes exactly.

### 14. NETWORK:BATCH (frameCount=1, one CREATE_NODE, arena delta = "Hi")

The single opcode is `TREE:CREATE_NODE (id=1, VSTACK)` from vector 1. The arena
delta is the self-describing entry for `"Hi"`: `[02 00 00 00][48 69]`.

```
4C 50 4C 50 01 00 00 00 01 00 00 00 01 00 00 00
01 01 00 00 01 00 00 00 10 00 00 00 00 00 00 00
06 00 00 00 02 00 00 00 48 69
```

- `4C 50 4C 50` = magic `PLPL` (u32 `0x504C504C`, little-endian)
- `01 00` = version 1
- `00 00` = flags (guest → host)
- `01 00 00 00` = frameCount = 1
- `01 00 00 00` = opcodeCount = 1
- `01 01 00 00 01 00 00 00 10 00 00 00 00 00 00 00` = the CREATE_NODE opcode (16 bytes)
- `06 00 00 00` = arenaDeltaLen = 6
- `02 00 00 00 48 69` = arena entry `[len=2]["Hi"]`

### 15. NETWORK:BATCH (frameCount=2, empty opcode list, empty arena delta)

```
4C 50 4C 50 01 00 00 00 02 00 00 00 00 00 00 00
00 00 00 00
```

- `4C 50 4C 50` = magic `PLPL` (u32 `0x504C504C`, little-endian)
- `01 00` = version 1
- `00 00` = flags
- `02 00 00 00` = frameCount = 2
- `00 00 00 00` = opcodeCount = 0
- `00 00 00 00` = arenaDeltaLen = 0

### 16. NETWORK:BATCH (META:RESYNC request, host → guest)

The single opcode is `META:RESYNC` (vector 13). The batch carries the
`HOST_TO_GUEST` direction flag and an empty arena delta.

```
4C 50 4C 50 01 00 01 00 00 00 00 00 01 00 00 00
04 03 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00
```

- `4C 50 4C 50` = magic `PLPL` (u32 `0x504C504C`, little-endian)
- `01 00` = version 1
- `01 00` = flags = `HOST_TO_GUEST` (0x0001)
- `00 00 00 00` = frameCount = 0
- `01 00 00 00` = opcodeCount = 1
- `04 03 00 00 00 00 00 00 00 00 00 00 00 00 00 00` = the META:RESYNC opcode (16 bytes)
- `00 00 00 00` = arenaDeltaLen = 0

### 17. STYLE:SET_DESIGN_TOKEN (path="color.primary" arenaRef=0, valueType=COLOR=0x07, value=0xFF0000FF)

```
02 02 00 00 00 00 00 00 07 00 00 00 FF 00 00 FF
```

- `02` category = STYLE
- `02` command = SET_DESIGN_TOKEN
- `00 00` flags = 0
- `00 00 00 00` A = arenaRef = 0 (entry is `[u32 length][bytes]` in the arena; the string is `"color.primary"`)
- `07 00 00 00` B = valueType = 0x07 (COLOR)
- `FF 00 00 FF` C = 0xFF0000FF (opaque blue, `0xAARRGGBB`)

### 18. STYLE:SET_PROPERTY (id=1, propertyId=COLOR=0x100A, valueType=DESIGN_TOKEN=0x08, arenaRef=0)

A color property carrying a **token reference** instead of a literal: the
renderer resolves `"color.primary"` (arena entry at offset 0) against the token
tables and the current scheme.

```
02 01 00 00 01 00 00 00 0A 10 08 00 00 00 00 00
```

- `02` category = STYLE
- `01` command = SET_PROPERTY
- `00 00` flags = 0
- `01 00 00 00` A = nodeId = 1
- `0A 10 08 00` B = `(valueType << 16) | propertyId` = `(0x08 << 16) | 0x100A`
  - low two bytes `0A 10` = propertyId = 0x100A (COLOR)
  - high byte `08` = valueType = 0x08 (DESIGN_TOKEN)
- `00 00 00 00` C = arenaRef = 0 (`"color.primary"`)

### 19. NETWORK:BATCH (frameCount=3, one DESIGN_TOKEN-referencing SET_PROPERTY, arena delta = "color.primary")

The single opcode is vector 18. The arena delta is the self-describing entry for
`"color.primary"`: `[0D 00 00 00][63 6F 6C 6F 72 2E 70 72 69 6D 61 72 79]`.

```
4C 50 4C 50 01 00 00 00 03 00 00 00 01 00 00 00
02 01 00 00 01 00 00 00 0A 10 08 00 00 00 00 00
11 00 00 00 0D 00 00 00 63 6F 6C 6F 72 2E 70 72 69 6D 61 72 79
```

- `4C 50 4C 50` = magic `PLPL` (u32 `0x504C504C`, little-endian)
- `01 00` = version 1
- `00 00` = flags (guest → host)
- `03 00 00 00` = frameCount = 3
- `01 00 00 00` = opcodeCount = 1
- `02 01 00 00 01 00 00 00 0A 10 08 00 00 00 00 00` = the SET_PROPERTY opcode (16 bytes)
- `11 00 00 00` = arenaDeltaLen = 17
- `0D 00 00 00 63 6F 6C 6F 72 2E 70 72 69 6D 61 72 79` = arena entry `[len=13]["color.primary"]`

### 20. STYLE:SET_DESIGN_TOKEN (path="font.body.family" arenaRef=0, valueType=STRING=0x05, valueArenaRef=20)

A **STRING-valued** token override: the token path lives at arena offset 0
(`[len=16]["font.body.family"]`, 20 bytes), the value string `"Inter"` at
offset 20.

```
02 02 00 00 00 00 00 00 05 00 00 00 14 00 00 00
```

- `02` category = STYLE
- `02` command = SET_DESIGN_TOKEN
- `00 00` flags = 0
- `00 00 00 00` A = arenaRef = 0 (token path `"font.body.family"`)
- `05 00 00 00` B = valueType = 0x05 (STRING)
- `14 00 00 00` C = arenaRef = 20 (value string `"Inter"`)

---

## Design-Token Resolution Conformance

The token system (catalog, override/default resolution, `dark.` color-scheme
layer) is defined in [TOKENS.md](./TOKENS.md). Resolution is a renderer behavior
and is not byte-encodable; a conforming renderer MUST produce these outcomes.

Given the overrides:

| Token override (via `SET_DESIGN_TOKEN`) | Value |
|------------------------------------------|-------|
| `color.primary` | `0xFF2563EB` |
| `dark.color.primary` | `0xFF60A5FA` |
| `space.base` | `4.0` (F32) |

| Query | Active scheme | Resolves to | Rationale |
|-------|---------------|-------------|-----------|
| `color.primary` | dark | `0xFF60A5FA` | `dark.color.primary` override wins (dark layer) |
| `color.primary` | light | `0xFF2563EB` | dark layer skipped; base override wins |
| `color.primary` | dark, no `dark.*` override | base override `0xFF2563EB` | base override falls through when the dark layer is empty |
| `font.body.size` | either | renderer default | no override; defaults are renderer-owned |
| `font.body.size` | either, override only `font.body` | the `font.body` override | parent-path fallback |
| `space.2` | either | `8.0` | generative family: `space.base` (4.0) × 2 |
| `space.0.5` | either | `2.0` | generative family: fractional leaf |
| `space.2` | either, `space.base` not overridden | renderer default × 2 | generative base falls back to renderer defaults |

A property carrying the `DESIGN_TOKEN` value type (vector 18) resolves through
the same algorithm and MUST re-resolve when the active scheme changes.
