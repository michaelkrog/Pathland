# Pathland Conformance Test Vectors

**Wire protocol version:** 1
**Encoding:** little-endian
**Opcode size:** 16 bytes

This document provides **golden byte arrays** for the Pathland opcode protocol (see [OPCODE.md](./OPCODE.md)). A conforming implementation MUST:

- encode each opcode to exactly these 16 bytes, and
- decode these bytes to the equivalent opcode.

The vectors are enforced by the reference Rust encoder (`pathland-opcode`,
`crates/pathland-opcode/src/conformance.rs`).

## Opcode Layout

```
[Category: u8][Command: u8][Flags: u16][A: u32][B: u32][C: u32]
```

All multi-byte fields little-endian. `A`/`B`/`C` may carry `f32` bit patterns.

## Vectors

### 1. TREE:CREATE_NODE (id=1, VSTACK=0x0002)

```
01 01 00 00 01 00 00 00 02 00 00 00 00 00 00 00
```

- `01` category = TREE
- `01` command = CREATE_NODE
- `00 00` flags = 0
- `01 00 00 00` A = nodeId = 1
- `02 00 00 00` B = componentType = 0x0002 (VSTACK)
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
