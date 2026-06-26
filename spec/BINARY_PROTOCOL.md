# Pathland Binary Protocol Specification

**Version:** 1.0.0-alpha  
**Status:** Draft  
**Format:** Custom Binary Instruction Protocol  
**Last Updated:** June 25, 2026

---

## Overview

The Pathland Binary Protocol is a **custom binary instruction protocol** designed for efficient communication of UI tree mutations between applications and renderers. It is optimized for:

- Extremely frequent updates
- Small mutation packets
- Repeated opcodes and property keys
- Stable component types and property sets
- Linear, deterministic decoding

### Core Principles

1. **Instruction-based**: Protocol encodes a linear stream of instructions (mutations)
2. **Numeric IDs**: Uses numeric identifiers for opcodes, component types, and properties
3. **Fixed-width types**: Uses fixed-width binary types where possible
4. **Renderer-agnostic**: Contains only tree mutations, no renderer-specific operations
5. **Deterministic decoding**: Can be parsed linearly with a simple cursor
6. **Forward compatible**: Supports adding new opcodes, types, and properties

### Protocol Model

- The **application** (or worker) owns the canonical retained UI tree
- The protocol communicates only **tree mutations**
- The receiver (renderer or application) applies mutations to reconstruct the same tree
- Each message contains a **batch of instructions** to be executed in order

---

## Binary Format

### Endianness

All multi-byte values use **little-endian** byte order.

### Primitive Types

| Type | Size | Description |
|------|------|-------------|
| `u8` | 1 byte | Unsigned 8-bit integer (0-255) |
| `u16` | 2 bytes | Unsigned 16-bit integer (0-65,535) |
| `u32` | 4 bytes | Unsigned 32-bit integer (0-4,294,967,295) |
| `i32` | 4 bytes | Signed 32-bit integer |
| `f32` | 4 bytes | 32-bit floating point (IEEE 754) |
| `string` | Variable | Length-prefixed UTF-8 string |

### String Encoding

Strings are encoded as length-prefixed UTF-8:

```
[u32 byteLength][byte[byteLength]]
```

Example: `"hello"` (5 bytes)
```
05 00 00 00 68 65 6C 6C 6F
```

---

## Message Format

### Message Header

Each message begins with a header:

```
[u16 version][u32 instructionCount]
```

| Field | Type | Description |
|-------|------|-------------|
| `version` | u16 | Protocol version (currently 1) |
| `instructionCount` | u32 | Number of instructions in this message |

### Message Structure

```
+----------------+----------------+
| Version (2B)  | Instruction    |
|               | Count (4B)     |
+----------------+----------------+
| Instruction 1 (variable length) |
+----------------+
| Instruction 2 (variable length) |
+----------------+
| ...                         |
+----------------+
| Instruction N (variable length) |
+----------------+
```

---

## Instruction Format

Each instruction begins with an opcode:

```
[u8 opcode][payload...]
```

The payload structure depends on the opcode.

---

## Opcode Definitions

### Opcode Table

| Opcode | Value | Name | Description |
|--------|-------|------|-------------|
| 1 | 0x01 | `CREATE_NODE` | Create a new node |
| 2 | 0x02 | `DELETE_NODE` | Delete a node and its children |
| 3 | 0x03 | `INSERT_CHILD` | Insert a child into a parent |
| 4 | 0x04 | `REMOVE_CHILD` | Remove a child from a parent |
| 5 | 0x05 | `SET_PROPERTY` | Set a property on a node |

### Reserved Opcodes

| Range | Purpose |
|-------|---------|
| 0x06-0x7F | Future opcodes |
| 0x80-0xFF | Custom/extended opcodes |

Implementations SHOULD ignore unknown opcodes to maintain forward compatibility.

---

## Instruction Definitions

### 1. CREATE_NODE (0x01)

Creates a new node in the UI tree.

**Payload:**
```
[u32 nodeId][u16 componentType]
```

| Field | Type | Description |
|-------|------|-------------|
| `nodeId` | u32 | Unique identifier for the new node |
| `componentType` | u16 | Type of component (see Component Type Table) |

**Binary Layout:**
```
01  ID(4B)  Type(2B)
```

**Example:** Create a Text node with ID 42
```
01 2A 00 00 00 03 00
```

---

### 2. DELETE_NODE (0x02)

Deletes a node and all its children from the UI tree.

**Payload:**
```
[u32 nodeId]
```

| Field | Type | Description |
|-------|------|-------------|
| `nodeId` | u32 | ID of the node to delete |

**Binary Layout:**
```
02  ID(4B)
```

**Example:** Delete node with ID 42
```
02 2A 00 00 00
```

---

### 3. INSERT_CHILD (0x03)

Inserts a child into a parent node at a specific index.

**Payload:**
```
[u32 parentId][u32 childId][u32 index]
```

| Field | Type | Description |
|-------|------|-------------|
| `parentId` | u32 | ID of the parent node |
| `childId` | u32 | ID of the child node to insert |
| `index` | u32 | Position to insert at (0 = first, use UINT32_MAX for append) |

**Binary Layout:**
```
03  ParentID(4B)  ChildID(4B)  Index(4B)
```

**Example:** Insert node 42 into node 1 at index 0
```
03 01 00 00 00 2A 00 00 00 00 00 00 00
```

**Note:** If `index` equals `UINT32_MAX` (0xFFFFFFFF), the child is appended to the end.

---

### 4. REMOVE_CHILD (0x04)

Removes a child from its parent.

**Payload:**
```
[u32 parentId][u32 childId]
```

| Field | Type | Description |
|-------|------|-------------|
| `parentId` | u32 | ID of the parent node |
| `childId` | u32 | ID of the child node to remove |

**Binary Layout:**
```
04  ParentID(4B)  ChildID(4B)
```

**Example:** Remove node 42 from node 1
```
04 01 00 00 00 2A 00 00 00
```

---

### 5. SET_PROPERTY (0x05)

Sets a property on a node.

**Payload:**
```
[u32 nodeId][u16 propertyId][u8 valueType][value...]
```

| Field | Type | Description |
|-------|------|-------------|
| `nodeId` | u32 | ID of the node |
| `propertyId` | u16 | ID of the property to set (see Property ID Tables) |
| `valueType` | u8 | Type of the value (see Value Type Table) |
| `value` | Variable | The property value, encoded according to valueType |

**Binary Layout:**
```
05  NodeID(4B)  PropID(2B)  ValueType(1B)  Value(...)
```

**Example:** Set text property on node 42 to "Hello"
```
05 2A 00 00 00 0A 00 05 05 00 00 00 48 65 6C 6C 6F
```
Breakdown:
- `05` - SET_PROPERTY opcode
- `2A 00 00 00` - nodeId = 42
- `0A 00` - propertyId = 10 (TEXT)
- `05` - valueType = STRING (5)
- `05 00 00 00` - string length = 5
- `48 65 6C 6C 6F` - UTF-8 "Hello"

---

## Value Type Definitions

### Value Type Table

| Value Type | ID | Encoding |
|------------|----|----------|
| U8 | 0x01 | `u8` |
| U32 | 0x02 | `u32` |
| I32 | 0x03 | `i32` |
| F32 | 0x04 | `f32` |
| STRING | 0x05 | Length-prefixed UTF-8 string |
| ENUM | 0x06 | `u8` (enum value) |

### Reserved Value Types

| Range | Purpose |
|-------|---------|
| 0x07-0x7F | Future value types |
| 0x80-0xFF | Custom value types |

---

## Component Type Definitions

### Component Type Table

| Component | ID | Description |
|-----------|----|-------------|
| HSTACK | 0x0001 | Horizontal stack container |
| VSTACK | 0x0002 | Vertical stack container |
| TEXT | 0x0003 | Text display component |

### Reserved Component Types

| Range | Purpose |
|-------|---------|
| 0x0004-0x7FFF | Future core components |
| 0x8000-0xFFFF | Custom/experimental components |

Implementations SHOULD ignore nodes with unknown component types.

---

## Property ID Definitions

Properties are organized by component type. Each component type has its own property ID space.

### Shared Properties (All Components)

| Property | ID | Value Type | Description |
|----------|----|------------|-------------|
| Reserved | 0x0000 | - | Reserved, do not use |

### HSTACK / VSTACK Properties

| Property | ID | Value Type | Description |
|----------|----|------------|-------------|
| `spacing` | 0x0001 | F32 | Space between children |
| `alignment` | 0x0002 | ENUM | Cross-axis alignment |
| `justification` | 0x0003 | ENUM | Main-axis distribution |

### TEXT Properties

| Property | ID | Value Type | Description |
|----------|----|------------|-------------|
| `text` | 0x000A | STRING | Text content |
| `lineLimit` | 0x000B | U32 | Maximum number of lines (0 = unlimited) |
| `textAlignment` | 0x000C | ENUM | Text alignment |

### Style Properties

Style properties can be applied to any component.

| Property | ID | Value Type | Description |
|----------|----|------------|-------------|
| `backgroundColor` | 0x1001 | U32 | RGB color (0xRRGGBB) |
| `backgroundOpacity` | 0x1002 | F32 | Opacity (0.0 to 1.0) |
| `borderWidth` | 0x1003 | F32 | Border width in pixels |
| `borderColor` | 0x1004 | U32 | RGB color (0xRRGGBB) |
| `borderRadius` | 0x1005 | F32 | Border radius in pixels |
| `padding` | 0x1006 | F32 | Uniform padding in pixels |
| `fontSize` | 0x1007 | F32 | Font size in points |
| `fontWeight` | 0x1008 | ENUM | Font weight |
| `fontFamily` | 0x1009 | STRING | Font family name |
| `color` | 0x100A | U32 | Text color (0xRRGGBB) |

### Reserved Property IDs

| Range | Purpose |
|-------|---------|
| 0x0000 | Reserved |
| 0x000D-0x0FFF | Future HSTACK/VSTACK properties |
| 0x0010-0x0FFF | Future TEXT properties |
| 0x100B-0xFFFF | Future style properties |

---

## Enum Definitions

### Alignment Enum

Used for `alignment` property on HSTACK/VSTACK.

| Value | ID | Description |
|-------|----|-------------|
| START | 0x00 | Align to start/leading edge |
| CENTER | 0x01 | Align to center |
| END | 0x02 | Align to end/trailing edge |
| STRETCH | 0x03 | Stretch to fill |

### Justification Enum

Used for `justification` property on HSTACK/VSTACK.

| Value | ID | Description |
|-------|----|-------------|
| START | 0x00 | Pack at start |
| CENTER | 0x01 | Center with equal space on both sides |
| END | 0x02 | Pack at end |
| SPACE_BETWEEN | 0x03 | Equal space between children |
| SPACE_AROUND | 0x04 | Equal space around children |
| SPACE_EVENLY | 0x05 | Equal space between and around children |

### TextAlignment Enum

Used for `textAlignment` property on TEXT.

| Value | ID | Description |
|-------|----|-------------|
| LEADING | 0x00 | Align to leading edge |
| CENTER | 0x01 | Center align |
| TRAILING | 0x02 | Align to trailing edge |

### FontWeight Enum

Used for `fontWeight` style property.

| Value | ID | CSS Equivalent |
|-------|----|----------------|
| ULTRA_LIGHT | 0x00 | 100 |
| THIN | 0x01 | 200 |
| LIGHT | 0x02 | 300 |
| REGULAR | 0x03 | 400 |
| MEDIUM | 0x04 | 500 |
| SEMIBOLD | 0x05 | 600 |
| BOLD | 0x06 | 700 |
| HEAVY | 0x07 | 800 |
| BLACK | 0x08 | 900 |

### Reserved Enum Values

| Range | Purpose |
|-------|---------|
| 0x09-0x7F | Future font weights |
| 0x80-0xFF | Custom font weights |

---

## Color Encoding

Colors are encoded as 32-bit values in RGB format:

```
0xAARRGGBB  (for colors with alpha)
0x00RRGGBB  (for opaque colors, alpha = 1.0)
```

| Format | Encoding | Example |
|--------|----------|---------|
| Opaque Red | 0xFF0000 | 0xFF0000 |
| Semi-transparent Red | 0x80FF0000 | 50% opacity red |
| Opaque White | 0xFFFFFF | 0xFFFFFF |
| Opaque Black | 0x000000 | 0x000000 |

**Note:** Alpha is in the **most significant byte** (AA), followed by Red, Green, Blue.

---

## Complete Examples

### Example 1: Creating a Simple UI

This creates a VStack with a Text child displaying "Hello":

```
# Message Header
01 00          # version = 1
05 00 00 00    # instructionCount = 5

# Instruction 1: CREATE_NODE (VSTACK with ID 1)
01 01 00 00 00 02 00

# Instruction 2: CREATE_NODE (TEXT with ID 2)
01 02 00 00 00 03 00

# Instruction 3: SET_PROPERTY (text on node 2)
05 02 00 00 00 0A 00 05 05 00 00 00 48 65 6C 6C 6F

# Instruction 4: SET_PROPERTY (fontSize = 24 on node 2)
05 02 00 00 00 07 10 04 00 00 80 41
                    # valueType = F32 (0x04)
                    # value = 24.0 (f32: 0x41800000 in LE)

# Instruction 5: INSERT_CHILD (node 2 into node 1 at index 0)
03 01 00 00 00 02 00 00 00 00 00 00 00
```

### Example 2: Tap Event

```
# Message Header
01 00          # version = 1
01 00 00 00    # instructionCount = 1

# Note: Events use the same message format but with event-specific instructions
# This would be handled by a separate event protocol
```

**Note:** Event handling is currently out of scope for this protocol version. The protocol focuses on tree mutations from application to renderer. Events from renderer to application will be defined in a future version.

---

## Decoding Algorithm

```
function decodeMessage(buffer: Uint8Array): Instruction[] {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let cursor = 0;
  
  // Read header
  const version = view.getUint16(cursor, true); // little-endian
  cursor += 2;
  const instructionCount = view.getUint32(cursor, true);
  cursor += 4;
  
  const instructions = [];
  
  // Read each instruction
  for (let i = 0; i < instructionCount; i++) {
    const opcode = view.getUint8(cursor);
    cursor += 1;
    
    switch (opcode) {
      case 0x01: // CREATE_NODE
        const nodeId = view.getUint32(cursor, true);
        cursor += 4;
        const componentType = view.getUint16(cursor, true);
        cursor += 2;
        instructions.push({ opcode: 'CREATE_NODE', nodeId, componentType });
        break;
        
      case 0x02: // DELETE_NODE
        const deleteNodeId = view.getUint32(cursor, true);
        cursor += 4;
        instructions.push({ opcode: 'DELETE_NODE', nodeId: deleteNodeId });
        break;
        
      case 0x03: // INSERT_CHILD
        const parentId = view.getUint32(cursor, true);
        cursor += 4;
        const childId = view.getUint32(cursor, true);
        cursor += 4;
        const index = view.getUint32(cursor, true);
        cursor += 4;
        instructions.push({ opcode: 'INSERT_CHILD', parentId, childId, index });
        break;
        
      case 0x04: // REMOVE_CHILD
        const removeParentId = view.getUint32(cursor, true);
        cursor += 4;
        const removeChildId = view.getUint32(cursor, true);
        cursor += 4;
        instructions.push({ opcode: 'REMOVE_CHILD', parentId: removeParentId, childId: removeChildId });
        break;
        
      case 0x05: // SET_PROPERTY
        const setNodeId = view.getUint32(cursor, true);
        cursor += 4;
        const propertyId = view.getUint16(cursor, true);
        cursor += 2;
        const valueType = view.getUint8(cursor);
        cursor += 1;
        
        let value;
        switch (valueType) {
          case 0x01: // U8
            value = view.getUint8(cursor);
            cursor += 1;
            break;
          case 0x02: // U32
            value = view.getUint32(cursor, true);
            cursor += 4;
            break;
          case 0x03: // I32
            value = view.getInt32(cursor, true);
            cursor += 4;
            break;
          case 0x04: // F32
            value = view.getFloat32(cursor, true);
            cursor += 4;
            break;
          case 0x05: // STRING
            const strLen = view.getUint32(cursor, true);
            cursor += 4;
            value = new TextDecoder().decode(buffer.subarray(cursor, cursor + strLen));
            cursor += strLen;
            break;
          case 0x06: // ENUM
            value = view.getUint8(cursor);
            cursor += 1;
            break;
          default:
            throw new Error(`Unknown value type: ${valueType}`);
        }
        instructions.push({ opcode: 'SET_PROPERTY', nodeId: setNodeId, propertyId, valueType, value });
        break;
        
      default:
        // Unknown opcode - skip payload based on opcode
        // For forward compatibility, we need to know how to skip
        // This requires a payload length field or fixed payload sizes
        // For now, we'll skip 1 byte and continue (this is a limitation)
        cursor += 1;
        break;
    }
  }
  
  return instructions;
}
```

---

## Transport

The protocol is transport-agnostic. Messages can be sent over:

- **WebSocket**: Send ArrayBuffer directly
- **Web Workers**: Use `postMessage` with transferable ArrayBuffer
- **IPC**: Send raw bytes
- **Shared Memory**: Copy to shared buffer
- **Files**: Write/read binary files
- **Custom**: Any transport that can carry bytes

### Browser Web Worker Example

```javascript
// Main thread to Worker
const message = encodeMessage([
  { opcode: 'CREATE_NODE', nodeId: 1, componentType: 0x0001 }, // HSTACK
  { opcode: 'CREATE_NODE', nodeId: 2, componentType: 0x0003 }, // TEXT
  { opcode: 'SET_PROPERTY', nodeId: 2, propertyId: 0x000A, valueType: 0x05, value: "Hello" },
  { opcode: 'INSERT_CHILD', parentId: 1, childId: 2, index: 0 }
]);

worker.postMessage(message, [message]); // Transfer ownership

// Worker receives
self.onmessage = (e) => {
  const instructions = decodeMessage(new Uint8Array(e.data));
  executeInstructions(instructions);
};
```

### WebSocket Example

```javascript
// Client
const message = encodeMessage(instructions);
socket.send(message);

// Server
socket.on('message', (buffer) => {
  const instructions = decodeMessage(new Uint8Array(buffer));
  executeInstructions(instructions);
});
```

---

## Protocol Versioning

### Version 1

- Initial version
- Defines opcodes 1-5
- Defines component types 1-3
- Defines property IDs for HSTACK/VSTACK and TEXT
- Defines basic value types

### Future Versions

New versions may:
- Add new opcodes (in reserved ranges)
- Add new component types (in reserved ranges)
- Add new property IDs (in reserved ranges)
- Add new value types (in reserved ranges)

### Version Detection

The version field in the message header allows receivers to:
- Detect protocol version
- Handle messages appropriately
- Reject unsupported versions

---

## Error Handling

### Unknown Opcodes

Implementations SHOULD:
1. Skip unknown opcodes
2. Continue processing remaining instructions
3. Log a warning for debugging

### Invalid Data

Implementations SHOULD:
1. Validate instruction payloads
2. Skip invalid instructions
3. Continue processing remaining instructions
4. Log errors for debugging

### Buffer Overflow

Implementations SHOULD:
1. Check that the buffer is large enough for the declared instruction count
2. Reject messages with mismatched sizes
3. Log security warnings

---

## Security Considerations

### Input Validation

- Validate message header (version, instruction count)
- Validate that buffer size matches declared instruction count
- Validate node IDs are non-zero (0 is reserved)
- Validate property IDs are in valid ranges
- Validate value types are in valid ranges

### Resource Limits

- Limit maximum message size
- Limit maximum instruction count per message
- Limit maximum string length
- Limit maximum depth of nested structures

### Rate Limiting

- Limit message rate from untrusted sources
- Batch multiple mutations to reduce message count

---

## Conformance

A conforming Pathland implementation MUST:

1. Support the binary format as defined in this specification
2. Accept messages with version 1
3. Handle all defined opcodes (1-5)
4. Handle all defined component types (1-3)
5. Handle all defined property IDs
6. Use little-endian byte order
7. Use the specified encoding for all types

A conforming implementation MAY:

1. Support additional opcodes
2. Support additional component types
3. Support additional property IDs
4. Support additional value types
5. Optimize encoding/decoding for their platform
6. Support other transport mechanisms

---

## Appendix A: Constant Reference

### Opcodes

```
CREATE_NODE = 0x01
DELETE_NODE = 0x02
INSERT_CHILD = 0x03
REMOVE_CHILD = 0x04
SET_PROPERTY = 0x05
```

### Component Types

```
HSTACK = 0x0001
VSTACK = 0x0002
TEXT = 0x0003
```

### HSTACK/VSTACK Properties

```
SPACING = 0x0001
ALIGNMENT = 0x0002
JUSTIFICATION = 0x0003
```

### TEXT Properties

```
TEXT = 0x000A
LINE_LIMIT = 0x000B
TEXT_ALIGNMENT = 0x000C
```

### Style Properties

```
BACKGROUND_COLOR = 0x1001
BACKGROUND_OPACITY = 0x1002
BORDER_WIDTH = 0x1003
BORDER_COLOR = 0x1004
BORDER_RADIUS = 0x1005
PADDING = 0x1006
FONT_SIZE = 0x1007
FONT_WEIGHT = 0x1008
FONT_FAMILY = 0x1009
COLOR = 0x100A
```

### Value Types

```
U8 = 0x01
U32 = 0x02
I32 = 0x03
F32 = 0x04
STRING = 0x05
ENUM = 0x06
```

### Enums

```
// Alignment
START = 0x00
CENTER = 0x01
END = 0x02
STRETCH = 0x03

// Justification
SPACE_BETWEEN = 0x03
SPACE_AROUND = 0x04
SPACE_EVENLY = 0x05

// TextAlignment
LEADING = 0x00
CENTER = 0x01
TRAILING = 0x02

// FontWeight
ULTRA_LIGHT = 0x00
THIN = 0x01
LIGHT = 0x02
REGULAR = 0x03
MEDIUM = 0x04
SEMIBOLD = 0x05
BOLD = 0x06
HEAVY = 0x07
BLACK = 0x08
```

---

## Appendix B: JavaScript Reference Implementation

```javascript
// ============================================
// CONSTANTS
// ============================================

// Opcodes
const OPCODES = {
  CREATE_NODE: 0x01,
  DELETE_NODE: 0x02,
  INSERT_CHILD: 0x03,
  REMOVE_CHILD: 0x04,
  SET_PROPERTY: 0x05
};

// Component Types
const COMPONENT_TYPES = {
  HSTACK: 0x0001,
  VSTACK: 0x0002,
  TEXT: 0x0003
};

// Value Types
const VALUE_TYPES = {
  U8: 0x01,
  U32: 0x02,
  I32: 0x03,
  F32: 0x04,
  STRING: 0x05,
  ENUM: 0x06
};

// Properties
const PROPERTIES = {
  // HSTACK/VSTACK
  SPACING: 0x0001,
  ALIGNMENT: 0x0002,
  JUSTIFICATION: 0x0003,
  
  // TEXT
  TEXT: 0x000A,
  LINE_LIMIT: 0x000B,
  TEXT_ALIGNMENT: 0x000C,
  
  // Style
  BACKGROUND_COLOR: 0x1001,
  BACKGROUND_OPACITY: 0x1002,
  BORDER_WIDTH: 0x1003,
  BORDER_COLOR: 0x1004,
  BORDER_RADIUS: 0x1005,
  PADDING: 0x1006,
  FONT_SIZE: 0x1007,
  FONT_WEIGHT: 0x1008,
  FONT_FAMILY: 0x1009,
  COLOR: 0x100A
};

// Enums
const ALIGNMENT = {
  START: 0x00,
  CENTER: 0x01,
  END: 0x02,
  STRETCH: 0x03
};

const JUSTIFICATION = {
  START: 0x00,
  CENTER: 0x01,
  END: 0x02,
  SPACE_BETWEEN: 0x03,
  SPACE_AROUND: 0x04,
  SPACE_EVENLY: 0x05
};

const TEXT_ALIGNMENT = {
  LEADING: 0x00,
  CENTER: 0x01,
  TRAILING: 0x02
};

// ============================================
// ENCODING
// ============================================

class BinaryEncoder {
  constructor() {
    this.buffer = new ArrayBuffer(1024);
    this.view = new DataView(this.buffer);
    this.cursor = 0;
  }

  ensureCapacity(additionalBytes) {
    if (this.cursor + additionalBytes > this.buffer.byteLength) {
      const newBuffer = new ArrayBuffer(Math.max(this.buffer.byteLength * 2, this.cursor + additionalBytes));
      const newView = new DataView(newBuffer);
      new Uint8Array(newView.buffer).set(new Uint8Array(this.buffer, 0, this.cursor));
      this.buffer = newBuffer;
      this.view = newView;
    }
  }

  writeU8(value) {
    this.ensureCapacity(1);
    this.view.setUint8(this.cursor, value);
    this.cursor += 1;
  }

  writeU16(value) {
    this.ensureCapacity(2);
    this.view.setUint16(this.cursor, value, true);
    this.cursor += 2;
  }

  writeU32(value) {
    this.ensureCapacity(4);
    this.view.setUint32(this.cursor, value, true);
    this.cursor += 4;
  }

  writeI32(value) {
    this.ensureCapacity(4);
    this.view.setInt32(this.cursor, value, true);
    this.cursor += 4;
  }

  writeF32(value) {
    this.ensureCapacity(4);
    this.view.setFloat32(this.cursor, value, true);
    this.cursor += 4;
  }

  writeString(value) {
    const bytes = new TextEncoder().encode(value);
    this.writeU32(bytes.length);
    this.ensureCapacity(bytes.length);
    new Uint8Array(this.buffer, this.cursor, bytes.length).set(bytes);
    this.cursor += bytes.length;
  }

  writeColor(r, g, b, a = 255) {
    const color = (a << 24) | (r << 16) | (g << 8) | b;
    this.writeU32(color);
  }

  // Helper: Encode a message with instructions
  encodeMessage(instructions) {
    // Calculate total size needed
    let totalSize = 6; // header: 2 + 4 bytes
    for (const inst of instructions) {
      totalSize += this.calculateInstructionSize(inst);
    }
    
    // Reset and ensure capacity
    this.cursor = 0;
    this.ensureCapacity(totalSize);
    
    // Write header
    this.writeU16(1); // version
    this.writeU32(instructions.length);
    
    // Write instructions
    for (const inst of instructions) {
      this.writeInstruction(inst);
    }
    
    return new Uint8Array(this.buffer, 0, this.cursor);
  }

  calculateInstructionSize(inst) {
    switch (inst.opcode) {
      case 'CREATE_NODE':
        return 1 + 4 + 2; // opcode + nodeId + componentType
      case 'DELETE_NODE':
        return 1 + 4; // opcode + nodeId
      case 'INSERT_CHILD':
        return 1 + 4 + 4 + 4; // opcode + parentId + childId + index
      case 'REMOVE_CHILD':
        return 1 + 4 + 4; // opcode + parentId + childId
      case 'SET_PROPERTY':
        return 1 + 4 + 2 + 1 + this.calculateValueSize(inst.valueType, inst.value);
      default:
        return 1; // opcode only (minimum)
    }
  }

  calculateValueSize(valueType, value) {
    switch (valueType) {
      case VALUE_TYPES.U8: return 1;
      case VALUE_TYPES.U32: return 4;
      case VALUE_TYPES.I32: return 4;
      case VALUE_TYPES.F32: return 4;
      case VALUE_TYPES.STRING: return 4 + value.length;
      case VALUE_TYPES.ENUM: return 1;
      default: return 0;
    }
  }

  writeInstruction(inst) {
    this.writeU8(OPCODES[inst.opcode]);
    
    switch (inst.opcode) {
      case 'CREATE_NODE':
        this.writeU32(inst.nodeId);
        this.writeU16(inst.componentType);
        break;
      case 'DELETE_NODE':
        this.writeU32(inst.nodeId);
        break;
      case 'INSERT_CHILD':
        this.writeU32(inst.parentId);
        this.writeU32(inst.childId);
        this.writeU32(inst.index ?? 0xFFFFFFFF); // Default to append
        break;
      case 'REMOVE_CHILD':
        this.writeU32(inst.parentId);
        this.writeU32(inst.childId);
        break;
      case 'SET_PROPERTY':
        this.writeU32(inst.nodeId);
        this.writeU16(inst.propertyId);
        this.writeU8(inst.valueType);
        this.writeValue(inst.valueType, inst.value);
        break;
    }
  }

  writeValue(valueType, value) {
    switch (valueType) {
      case VALUE_TYPES.U8:
        this.writeU8(value);
        break;
      case VALUE_TYPES.U32:
        this.writeU32(value);
        break;
      case VALUE_TYPES.I32:
        this.writeI32(value);
        break;
      case VALUE_TYPES.F32:
        this.writeF32(value);
        break;
      case VALUE_TYPES.STRING:
        this.writeString(value);
        break;
      case VALUE_TYPES.ENUM:
        this.writeU8(value);
        break;
    }
  }
}

// ============================================
// DECODING
// ============================================

class BinaryDecoder {
  constructor(buffer) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    this.cursor = 0;
  }

  decodeMessage() {
    const version = this.readU16();
    const instructionCount = this.readU32();
    
    const instructions = [];
    for (let i = 0; i < instructionCount; i++) {
      instructions.push(this.decodeInstruction());
    }
    
    return { version, instructions };
  }

  readU8() {
    const value = this.view.getUint8(this.cursor);
    this.cursor += 1;
    return value;
  }

  readU16() {
    const value = this.view.getUint16(this.cursor, true);
    this.cursor += 2;
    return value;
  }

  readU32() {
    const value = this.view.getUint32(this.cursor, true);
    this.cursor += 4;
    return value;
  }

  readI32() {
    const value = this.view.getInt32(this.cursor, true);
    this.cursor += 4;
    return value;
  }

  readF32() {
    const value = this.view.getFloat32(this.cursor, true);
    this.cursor += 4;
    return value;
  }

  readString() {
    const length = this.readU32();
    const value = new TextDecoder().decode(
      new Uint8Array(this.view.buffer, this.view.byteOffset + this.cursor, length)
    );
    this.cursor += length;
    return value;
  }

  readColor() {
    const color = this.readU32();
    return {
      a: (color >> 24) & 0xFF,
      r: (color >> 16) & 0xFF,
      g: (color >> 8) & 0xFF,
      b: color & 0xFF
    };
  }

  decodeInstruction() {
    const opcode = this.readU8();
    
    switch (opcode) {
      case OPCODES.CREATE_NODE:
        return {
          opcode: 'CREATE_NODE',
          nodeId: this.readU32(),
          componentType: this.readU16()
        };
      case OPCODES.DELETE_NODE:
        return {
          opcode: 'DELETE_NODE',
          nodeId: this.readU32()
        };
      case OPCODES.INSERT_CHILD:
        return {
          opcode: 'INSERT_CHILD',
          parentId: this.readU32(),
          childId: this.readU32(),
          index: this.readU32()
        };
      case OPCODES.REMOVE_CHILD:
        return {
          opcode: 'REMOVE_CHILD',
          parentId: this.readU32(),
          childId: this.readU32()
        };
      case OPCODES.SET_PROPERTY:
        return {
          opcode: 'SET_PROPERTY',
          nodeId: this.readU32(),
          propertyId: this.readU16(),
          valueType: this.readU8(),
          value: this.readValue(this.readU8())
        };
      default:
        // Unknown opcode - skip and continue
        return { opcode: 'UNKNOWN', opcodeValue: opcode };
    }
  }

  readValue(valueType) {
    switch (valueType) {
      case VALUE_TYPES.U8: return this.readU8();
      case VALUE_TYPES.U32: return this.readU32();
      case VALUE_TYPES.I32: return this.readI32();
      case VALUE_TYPES.F32: return this.readF32();
      case VALUE_TYPES.STRING: return this.readString();
      case VALUE_TYPES.ENUM: return this.readU8();
      default: return null;
    }
  }
}

// ============================================
// USAGE EXAMPLE
// ============================================

// Create a simple UI with a VStack containing "Hello World"
const encoder = new BinaryEncoder();
const instructions = [
  { opcode: 'CREATE_NODE', nodeId: 1, componentType: COMPONENT_TYPES.VSTACK },
  { opcode: 'CREATE_NODE', nodeId: 2, componentType: COMPONENT_TYPES.TEXT },
  { opcode: 'SET_PROPERTY', nodeId: 2, propertyId: PROPERTIES.TEXT, valueType: VALUE_TYPES.STRING, value: "Hello World" },
  { opcode: 'INSERT_CHILD', parentId: 1, childId: 2, index: 0 }
];

const message = encoder.encodeMessage(instructions);

// Send to renderer
renderer.postMessage(message, [message]);

// In renderer
const decoder = new BinaryDecoder(message);
const { version, instructions: decoded } = decoder.decodeMessage();

for (const inst of decoded) {
  switch (inst.opcode) {
    case 'CREATE_NODE':
      createNode(inst.nodeId, inst.componentType);
      break;
    case 'SET_PROPERTY':
      setProperty(inst.nodeId, inst.propertyId, inst.valueType, inst.value);
      break;
    case 'INSERT_CHILD':
      insertChild(inst.parentId, inst.childId, inst.index);
      break;
    // ... handle other opcodes
  }
}
```

---

## Appendix C: Protocol Summary

| Aspect | Details |
|--------|---------|
| **Format** | Custom binary instruction protocol |
| **Endianness** | Little-endian |
| **Version** | 1 |
| **Opcodes** | 5 defined, 127 reserved |
| **Component Types** | 3 defined, 32,767 reserved |
| **Properties** | 12 defined, 65,527 reserved |
| **Value Types** | 6 defined, 121 reserved |
| **Transport** | Transport-agnostic (ArrayBuffer) |

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0-alpha | 2026-06-25 | Initial custom binary protocol specification |
