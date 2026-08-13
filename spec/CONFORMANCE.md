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

### 3. LAYOUT:SET_ORIGIN (id=2, x=8.0, y=8.0)

```
02 01 00 00 02 00 00 00 00 00 00 41 00 00 00 41
```

- `02` category = LAYOUT
- `01` command = SET_ORIGIN
- `00 00` flags = 0
- `02 00 00 00` A = nodeId = 2
- `00 00 00 41` B = x = 8.0 (f32 LE: 0x41000000)
- `00 00 00 41` C = y = 8.0

### 4. LAYOUT:SET_SIZE (id=2, w=16.0, h=16.0)

```
02 02 00 00 02 00 00 00 00 00 80 41 00 00 80 41
```

- `02` category = LAYOUT
- `02` command = SET_SIZE
- `00 00` flags = 0
- `02 00 00 00` A = nodeId = 2
- `00 00 80 41` B = w = 16.0 (f32 LE: 0x41800000)
- `00 00 80 41` C = h = 16.0

### 5. STYLE:SET_PROPERTY (id=2, propertyId=COLOR=0x100A, valueType=COLOR=0x07, rgba=0xFF0000FF)

```
03 01 00 00 02 00 00 00 0A 10 07 00 FF 00 00 FF
```

- `03` category = STYLE
- `01` command = SET_PROPERTY
- `00 00` flags = 0
- `02 00 00 00` A = nodeId = 2
- `0A 10 07 00` B = `(valueType << 16) | propertyId` = `(0x07 << 16) | 0x100A`
  - low two bytes `0A 10` = propertyId = 0x100A (COLOR)
  - high byte `07` = valueType = 0x07 (COLOR)
- `FF 00 00 FF` C = 0xFF0000FF (opaque blue, `0xAARRGGBB`)

### 6. STYLE:SET_TEXT (id=2, arenaRef=0)

```
03 03 00 00 02 00 00 00 00 00 00 00 00 00 00 00
```

- `03` category = STYLE
- `03` command = SET_TEXT
- `00 00` flags = 0
- `02 00 00 00` A = nodeId = 2
- `00 00 00 00` B = arenaRef = 0 (entry is `[u32 length][bytes]` in the arena)
- `00 00 00 00` C = 0

### 7. META:RESET

```
07 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00
```

- `07` category = META
- `01` command = RESET
- `00 00` flags = 0
- `00 00 00 00` A = 0
- `00 00 00 00` B = 0
- `00 00 00 00` C = 0

---

## Frame Conformance

A complete frame is: opcodes written into consecutive ring slots, then a
`frameCount` increment in the header block. Ring slot `i` occupies bytes
`[ringOffset + i*16, ringOffset + i*16 + 16)`.

The header block layout and ring semantics are defined in [OPCODE.md](./OPCODE.md#linear-memory-layout).
