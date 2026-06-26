# Pathland Binary Protocol Specification

**Version:** 2.0.0-alpha  
**Status:** Draft  
**Format:** Custom Binary Instruction Protocol  
**Last Updated:** June 26, 2026

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
| 6 | 0x06 | `SET_DESIGN_TOKEN` | Set a design token value globally |
| 7 | 0x07 | `DISPATCH_EVENT` | Dispatch an event to a component |
| 8 | 0x08 | `REGISTER_EVENT_HANDLER` | Register an event handler on a component |
| 9 | 0x09 | `GESTURE_UPDATE` | Dispatch a gesture state update |
| 10 | 0x0A | `ATTACH_GESTURE` | Attach a gesture recognizer to a component |
| 11 | 0x0B | `COMBINE_GESTURES` | Combine two gestures |

### Reserved Opcodes

| Range | Purpose |
|-------|---------|
| 0x0C-0x7F | Future opcodes |
| 0x80-0xFF | Custom/extended opcodes |

Implementations SHOULD ignore unknown opcodes to maintain forward compatibility.

---

## Instruction Definitions

### 1. CREATE_NODE (0x01)

Creates a new node in the UI tree. **Optionally includes initial property values** to avoid separate SET_PROPERTY commands.

**Payload:**
```
[u32 nodeId][u16 componentType][u8 propertyCount][property entries...]
```

**Property Entry Format:**
```
[u16 propertyId][u8 valueType][value...]
```

| Field | Type | Description |
|-------|------|-------------|
| `nodeId` | u32 | Unique identifier for the new node |
| `componentType` | u16 | Type of component (see Component Type Table) |
| `propertyCount` | u8 | Number of initial properties (0-255) |
| `propertyId` | u16 | ID of the property to set |
| `valueType` | u8 | Type of the value (see Value Type Table) |
| `value` | Variable | The property value, encoded according to valueType |

**Binary Layout:**
```
01  ID(4B)  Type(2B)  PropCount(1B)  [PropID(2B)  ValueType(1B)  Value(...)]...
```

**Example:** Create a Text node with ID 42 (no properties)
```
01 2A 00 00 00 03 00 00
```

**Example:** Create a Text node with ID 42 and initial text
```
01 2A 00 00 00 03 00 01    # nodeId=42, type=TEXT, 1 property
0A 00                 # propertyId=TEXT (0x000A)
05                     # valueType=STRING (0x05)
05 00 00 00            # string length=5
48 65 6C 6C 6F         # "Hello"
```

**Example:** Create a Text node with ID 42, text, and color
```
01 2A 00 00 00 03 00 02    # nodeId=42, type=TEXT, 2 properties
0A 00 05 05 00 00 00 48 65 6C 6C 6F  # text="Hello"
10 0A 07 01 06 00        # color=PRIMARY_TEXT (SEMANTIC_TOKEN)
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

Sets or updates a property on an **existing node**. 

**Note:** For setting initial properties when creating a node, use CREATE_NODE with inline properties instead. This command is primarily for updating properties after node creation.

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
| COLOR | 0x07 | Tagged union: [u8 colorKind][payload] |
| DESIGN_TOKEN | 0x08 | Length-prefixed UTF-8 string (token path) |

### Reserved Value Types

| Range | Purpose |
|-------|---------|
| 0x09-0x7F | Future value types |
| 0x80-0xFF | Custom value types |

### Color Value Type

The `COLOR` value type (0x07) is a **tagged union** that supports both semantic color tokens and literal sRGB colors.

**Encoding:**
```
[u8 colorKind][payload]
```

#### Color Kind Table

| Kind | Value | Payload | Description |
|------|-------|---------|-------------|
| SEMANTIC_TOKEN | 0x01 | u16 tokenId | Semantic color token |
| LITERAL_SRGB | 0x02 | u32 rgba | Literal sRGB color |

#### Semantic Color Tokens

Semantic color tokens represent platform-agnostic color roles that adapt to the renderer's theme, accessibility settings, and platform conventions.

**Token Table:**

| Token | ID | Hex | Description |
|-------|----|-----|-------------|
| PRIMARY_TEXT | 0x0001 | 1 | Primary text color (adapts to light/dark mode) |
| SECONDARY_TEXT | 0x0002 | 2 | Secondary text color |
| TERTIARY_TEXT | 0x0003 | 3 | Tertiary text color |
| BACKGROUND | 0x0004 | 4 | Primary background color |
| SURFACE | 0x0005 | 5 | Surface/secondary background color |
| ACCENT | 0x0006 | 6 | Accent color for interactive elements |
| ERROR | 0x0007 | 7 | Error state color |
| SUCCESS | 0x0008 | 8 | Success state color |
| WARNING | 0x0009 | 9 | Warning state color |
| INFO | 0x000A | 10 | Informational state color |
| BORDER | 0x000B | 11 | Border color |
| SEPARATOR | 0x000C | 12 | Separator/divider color |

**Reserved Token IDs:**
- 0x0000: Reserved
- 0x000D-0xFFFF: Future semantic tokens

**Semantic Token Encoding:**
```
07 01 [u16 tokenId]
```

Example: PRIMARY_TEXT token
```
07 01 01 00
```

#### Literal sRGB Colors

Literal colors are encoded as **sRGB** with the following characteristics:

- **Color Space**: sRGB (IEC 61966-2-1)
- **White Point**: D65
- **Transfer Function**: Standard sRGB gamma (IEC 61966-2-1)
- **Encoding**: Packed RGBA (32-bit)

**Important**: All literal colors in the Pathland protocol MUST be interpreted as sRGB. This ensures consistent color definition across all renderers, even though physical display characteristics may vary.

**Protocol Guarantee**: The protocol guarantees consistent **color definition** (sRGB), not identical physical appearance across all displays.

**Bit Layout:**
```
0xAARRGGBB
```

- **AA**: Alpha channel (0x00 = transparent, 0xFF = opaque)
- **RR**: Red channel (0x00-0xFF)
- **GG**: Green channel (0x00-0xFF)
- **BB**: Blue channel (0x00-0xFF)

**Byte Order**: The 32-bit RGBA value is stored in **little-endian** format:
```
[BB][GG][RR][AA]
```

**Literal sRGB Encoding:**
```
07 02 [u32 rgba]
```

**Examples:**

| Color | RGBA Hex | Little-Endian Bytes |
|-------|----------|---------------------|
| Opaque Red | 0xFFFF0000 | `00 00 FF FF` |
| Opaque Green | 0xFF00FF00 | `00 FF 00 FF` |
| Opaque Blue | 0xFF0000FF | `FF 00 00 FF` |
| Opaque White | 0xFFFFFFFF | `FF FF FF FF` |
| Opaque Black | 0xFF000000 | `00 00 00 FF` |
| 50% Transparent Red | 0x80FF0000 | `00 00 FF 80` |
| 50% Transparent Blue | 0x800000FF | `FF 00 00 80` |

Example: Opaque red (0xFFFF0000)
```
07 02 00 00 FF FF
```

#### DESIGN_TOKEN Value Type

The `DESIGN_TOKEN` value type (0x08) represents a reference to a design token by its path.

**Encoding:**
```
[u8 valueType=0x08][u32 pathLength][utf8 path...]
```

**Token Path Format:**
- Dot-separated path: `category.tokenName`
- Examples: `color.primary`, `font.body`, `space.2`, `radius.medium`
- Case-sensitive, lowercase recommended

**DESIGN_TOKEN Encoding:**
```
08 [u32 pathLength][utf8 path...]
```

**Examples:**

| Token Path | Bytes |
|------------|-------|
| `color.primary` | `08 0D 00 00 00 63 6F 6C 6F 72 2E 70 72 69 6D 61 72 79` |
| `font.body` | `08 09 00 00 00 66 6F 6E 74 2E 62 6F 64 79` |
| `space.2` | `08 07 00 00 00 73 70 61 63 65 2E 32` |

---

### 6. SET_DESIGN_TOKEN (0x06)

Sets a design token value globally, overriding the renderer's default theme.

**Payload:**
```
[u32 tokenId][u16 valueType][value...]
```

| Field | Type | Description |
|-------|------|-------------|
| `tokenId` | u32 | Unique identifier for the token override |
| `valueType` | u16 | Type of the token value (see Token Value Types) |
| `value` | Variable | The token value, encoded according to valueType |

**Binary Layout:**
```
06  TokenID(4B)  ValueType(2B)  Value(...)
```

**Token Value Types:**
- `0x0001`: COLOR (uses COLOR value type encoding)
- `0x0002`: F32 (for spacing, sizes, etc.)
- `0x0003`: STRING (for font families, etc.)
- `0x0004`: U32 (for discrete values)

**Example:** Set color.primary token to a semantic token
```
06 01 00 00 00 00 01 07 01 06 00
```
Breakdown:
- `06` - SET_DESIGN_TOKEN opcode
- `01 00 00 00` - tokenId = 1
- `00 01` - valueType = COLOR (0x0001)
- `07` - COLOR value type
- `01` - colorKind = SEMANTIC_TOKEN
- `06 00` - tokenId = ACCENT (0x0006)

**Example:** Set space.2 token to 8.0
```
06 02 00 00 00 00 02 04 00 00 00 40 41
```
Breakdown:
- `06` - SET_DESIGN_TOKEN opcode
- `02 00 00 00` - tokenId = 2
- `00 02` - valueType = F32 (0x0002)
- `04` - F32 value type
- `00 00 00 40 41` - f32 value 8.0 (0x41000000 in LE)

**Note:** Token IDs are assigned by the application and used for reference. The actual token path resolution is handled by the renderer's theme system.

---

### 7. DISPATCH_EVENT (0x07)

Dispatches an event to a component in the UI tree.

**Payload:**
```
[u32 targetId][u8 eventType][u32 timestamp][u8 phase][event-specific data...]
```

| Field | Type | Description |
|-------|------|-------------|
| `targetId` | u32 | ID of the target component |
| `eventType` | u8 | Type of event (see Event Type Table) |
| `timestamp` | u32 | Milliseconds since epoch (little-endian) |
| `phase` | u8 | Event phase (0x00=capture, 0x01=target, 0x02=bubble) |

**Binary Layout:**
```
07  TargetID(4B)  EventType(1B)  Timestamp(4B)  Phase(1B)  [EventData...]
```

**Example:** Dispatch a tap event to node 42 in target phase
```
07 2A 00 00 00 01 60 6E 9A 01 01 00 00 00 80 3F 00 00 80 3F
```
Breakdown:
- `07` - DISPATCH_EVENT opcode
- `2A 00 00 00` - targetId = 42
- `01` - eventType = TAP (0x01)
- `60 6E 9A 01` - timestamp (example: 1699911200 = 2023-11-15)
- `01` - phase = TARGET (0x01)
- `00 00 80 3F` - x = 1.0 (f32)
- `00 00 80 3F` - y = 1.0 (f32)

---

### 8. REGISTER_EVENT_HANDLER (0x08)

Registers an event handler on a component.

**Payload:**
```
[u32 nodeId][u8 eventType][u8 handlerPhase][u32 handlerId]
```

| Field | Type | Description |
|-------|------|-------------|
| `nodeId` | u32 | ID of the component |
| `eventType` | u8 | Type of event to handle (see Event Type Table) |
| `handlerPhase` | u8 | Which phase to handle (0x00=capture, 0x01=target, 0x02=bubble, 0xFF=any) |
| `handlerId` | u32 | Unique identifier for the handler (used for callback) |

**Binary Layout:**
```
08  NodeID(4B)  EventType(1B)  Phase(1B)  HandlerID(4B)
```

**Example:** Register a tap handler on node 42 for target phase
```
08 2A 00 00 00 01 01 05 00 00 00
```
Breakdown:
- `08` - REGISTER_EVENT_HANDLER opcode
- `2A 00 00 00` - nodeId = 42
- `01` - eventType = TAP (0x01)
- `01` - handlerPhase = TARGET (0x01)
- `05 00 00 00` - handlerId = 5

**Handler Phase Values:**
- `0x00`: Capture phase only
- `0x01`: Target phase only
- `0x02`: Bubble phase only
- `0xFF`: All phases (capture, target, bubble)

---

## Event System

### Event Type Table

| Event Type | ID | Description | Data Payload |
|------------|----|-------------|--------------|
| TAP | 0x01 | Single tap/click | `[f32 x][f32 y][u8 tapCount]` |
| DOUBLE_TAP | 0x02 | Double tap/click | `[f32 x][f32 y][u8 tapCount=2]` |
| LONG_PRESS | 0x03 | Long press | `[f32 x][f32 y][f32 duration][f32 pressure]` |
| CLICK | 0x04 | Mouse click | `[f32 x][f32 y][u8 button][u8 clickCount][u8 modifiers]` |
| HOVER | 0x05 | Hover state change | `[u8 isHovering][f32 x][f32 y]` |
| FOCUS | 0x06 | Focus state change | `[u8 isFocused]` |
| BLUR | 0x07 | Blur (focus lost) | `[u8 isFocused=false]` |
| KEY_DOWN | 0x08 | Key pressed | `[u16 keyCode][u8 modifiers][u8 repeat]` |
| KEY_UP | 0x09 | Key released | `[u16 keyCode][u8 modifiers]` |
| SCROLL | 0x0A | Scroll action | `[f32 deltaX][f32 deltaY][f32 offsetX][f32 offsetY]` |
| SWIPE | 0x0B | Swipe gesture | `[u8 direction][f32 velocity][f32 distance]` |
| **ON_APPEAR** | **0x0C** | **Component mounted** | **None** |
| **ON_DISAPPEAR** | **0x0D** | **Component unmounted** | **None** |
| **ON_CHANGE** | **0x0E** | **Property changed** | **[u16 propertyId][value...]** |

**Event Phase Enum:**
| Phase | Value | Description |
|-------|-------|-------------|
| CAPTURE | 0x00 | Event traveling from root to target |
| TARGET | 0x01 | Event at target component |
| BUBBLE | 0x02 | Event traveling from target to root |

**Modifier Flags (u8):**
- Bit 0 (0x01): Shift key
- Bit 1 (0x02): Control key
- Bit 2 (0x04): Alt key
- Bit 3 (0x08): Meta key (Command/Windows)

**Button Enum:**
| Button | Value |
|--------|-------|
| LEFT | 0x00 |
| RIGHT | 0x01 |
| MIDDLE | 0x02 |
| BACK | 0x03 |
| FORWARD | 0x04 |

**Direction Enum (for SWIPE):**
| Direction | Value |
|-----------|-------|
| LEFT | 0x00 |
| RIGHT | 0x01 |
| UP | 0x02 |
| DOWN | 0x03 |

### Event Payload Details

#### ON_CHANGE Event
Dispatched when a property value changes on a component.

**Payload:**
```
[u16 propertyId][u8 valueType][value...]
```

**Example:** Color property changed from red to blue
```
0C 0E  // ON_CHANGE event type
0A 00  // propertyId = COLOR (0x000A)
07      // valueType = COLOR
02      // colorKind = LITERAL_SRGB
FF 00 00 FF  // newValue = opaque blue (0xFF0000FF)
```

#### ON_APPEAR / ON_DISAPPEAR Events
Lifecycle events with no additional data payload.

**Payload:** None (only header)

**Example:** Component mounted
```
0C 0C  // ON_APPEAR event type
```

#### TAP / DOUBLE_TAP Events

**Payload:**
```
[f32 x][f32 y][u8 tapCount]
```

**Example:** Single tap at (100, 200)
```
01       // TAP event type
00 00 C8 42  // x = 100.0 (f32)
00 00 34 43  // y = 200.0 (f32)
01       // tapCount = 1
```

#### KEY_DOWN / KEY_UP Events

**Key Codes (u16):** Standard key codes matching platform conventions.

**Example:** Key 'A' pressed with Shift modifier
```
08       // KEY_DOWN event type
41 00    // keyCode = 0x0041 ('A')
01       // modifiers = Shift (0x01)
00       // repeat = false
```

#### SCROLL Event

**Payload:**
```
[f32 deltaX][f32 deltaY][f32 contentOffsetX][f32 contentOffsetY]
```

**Example:** Scroll down by 50 pixels
```
0A       // SCROLL event type
00 00 00 00  // deltaX = 0.0
00 00 9A 42  // deltaY = 50.0
00 00 00 00  // contentOffsetX = 0.0
00 00 80 42  // contentOffsetY = 100.0
```

---

## Gesture System

### Overview

The Pathland gesture system provides a **stateful, composable** approach to handling user interactions, inspired by SwiftUI's gesture model. Unlike traditional event systems that dispatch discrete events, gestures maintain state through a lifecycle (began, changed, ended, cancelled) and can be combined in powerful ways.

**Core Principles:**
- **Stateful**: Gestures have a lifecycle with distinct states
- **Composable**: Multiple gestures can be combined (simultaneous, sequenced, exclusive)
- **Declarative**: Gestures are attached to components, not imperative event handlers
- **Renderer-agnostic**: Works across all platforms (touch, mouse, stylus)

**Relationship to Events:**
- Events are low-level input notifications (tap, click, scroll)
- Gestures are high-level interaction patterns built on top of events
- Both can coexist: use events for simple interactions, gestures for complex ones

---

### Gesture Type Table

| Gesture | ID | Description | States | Data Payload |
|---------|----|-------------|--------|--------------|
| TAP | 0x10 | Single tap gesture | began, ended | `[f32 startX][f32 startY][f32 locationX][f32 locationY][u8 tapCount]` |
| LONG_PRESS | 0x11 | Long press gesture | began, changed, ended, cancelled | `[f32 startX][f32 startY][f32 locationX][f32 locationY][f32 duration][f32 pressure]` |
| DRAG | 0x12 | Drag/panning gesture | began, changed, ended, cancelled | `[f32 startX][f32 startY][f32 locationX][f32 locationY][f32 translationX][f32 translationY][f32 velocityX][f32 velocityY]` |
| SWIPE | 0x13 | Swipe gesture | began, changed, ended, cancelled | `[f32 startX][f32 startY][f32 locationX][f32 locationY][f32 translationX][f32 translationY][f32 velocity][u8 direction]` |
| PINCH | 0x14 | Pinch/zoom gesture | began, changed, ended, cancelled | `[f32 startScale][f32 scale][f32 velocity][f32 startLocationX][f32 startLocationY]` |
| ROTATE | 0x15 | Rotation gesture | began, changed, ended, cancelled | `[f32 startRotation][f32 rotation][f32 velocity][f32 startLocationX][f32 startLocationY]` |

**Gesture State Enum:**
| State | Value | Description |
|-------|-------|-------------|
| BEGAN | 0x00 | Gesture recognition has started |
| CHANGED | 0x01 | Gesture is actively changing |
| ENDED | 0x02 | Gesture completed successfully |
| CANCELLED | 0x03 | Gesture was interrupted/cancelled |

---

### Gesture Binary Encoding

#### Opcode: GESTURE_UPDATE (0x09)

Dispatches a gesture state update to a component.

**Payload:**
```
[u32 targetId][u8 gestureType][u8 gestureState][u32 timestamp][u32 gestureId][gesture-specific data...]
```

| Field | Type | Description |
|-------|------|-------------|
| `targetId` | u32 | ID of the component receiving the gesture |
| `gestureType` | u8 | Type of gesture (0x10-0x15) |
| `gestureState` | u8 | Current state of the gesture (0x00-0x03) |
| `timestamp` | u32 | Milliseconds since epoch |
| `gestureId` | u32 | Unique identifier for this gesture instance |

**Binary Layout:**
```
09  TargetID(4B)  GestureType(1B)  GestureState(1B)  Timestamp(4B)  GestureID(4B)  [Data...]
```

**Example:** Drag gesture began on node 42
```
09 2A 00 00 00 12 00 60 6E 9A 01 01 00 00 00 00 80 3F 00 00 00 00
```
Breakdown:
- `09` - GESTURE_UPDATE opcode
- `2A 00 00 00` - targetId = 42
- `12` - gestureType = DRAG (0x12)
- `00` - gestureState = BEGAN (0x00)
- `60 6E 9A 01` - timestamp
- `01 00 00 00` - gestureId = 1
- `00 00 80 3F` - startX = 1.0
- `00 00 00 00` - startY = 0.0

---

#### Opcode: ATTACH_GESTURE (0x0A)

Attaches a gesture recognizer to a component.

**Payload:**
```
[u32 nodeId][u8 gestureType][u32 gestureRecognizerId][u8 handlerPhase][u32 onBeganHandler][u32 onChangedHandler][u32 onEndedHandler][u32 onCancelledHandler]
```

| Field | Type | Description |
|-------|------|-------------|
| `nodeId` | u32 | ID of the component to attach gesture to |
| `gestureType` | u8 | Type of gesture (0x10-0x15) |
| `gestureRecognizerId` | u32 | Unique ID for this gesture recognizer |
| `handlerPhase` | u8 | Event phase (0x00=capture, 0x01=target, 0x02=bubble, 0xFF=any) |
| `onBeganHandler` | u32 | Handler ID for began state (0 = no handler) |
| `onChangedHandler` | u32 | Handler ID for changed state (0 = no handler) |
| `onEndedHandler` | u32 | Handler ID for ended state (0 = no handler) |
| `onCancelledHandler` | u32 | Handler ID for cancelled state (0 = no handler) |

**Binary Layout:**
```
0A  NodeID(4B)  GestureType(1B)  RecognizerID(4B)  Phase(1B)  OnBegan(4B)  OnChanged(4B)  OnEnded(4B)  OnCancelled(4B)
```

**Example:** Attach drag gesture to node 42
```
0A 2A 00 00 00 12 01 00 00 00 01 05 00 00 00 06 00 00 00 07 00 00 00
```
Breakdown:
- `0A` - ATTACH_GESTURE opcode
- `2A 00 00 00` - nodeId = 42
- `12` - gestureType = DRAG (0x12)
- `01 00 00 00` - gestureRecognizerId = 1
- `01` - handlerPhase = TARGET (0x01)
- `05 00 00 00` - onBeganHandler = 5
- `06 00 00 00` - onChangedHandler = 6
- `07 00 00 00` - onEndedHandler = 7
- `00 00 00 00` - onCancelledHandler = 0 (none)

---

### Gesture Combination

Multiple gestures can be combined to create complex interactions. The combination type determines how gestures interact.

**Combination Types:**
| Type | Value | Description |
|------|-------|-------------|
| SIMULTANEOUS | 0x00 | Both gestures must succeed simultaneously |
| SEQUENCED | 0x01 | First gesture must fail for second to start |
| EXCLUSIVE | 0x02 | First gesture to start wins, others are cancelled |

**Combination Format:**
```
[u8 combinationType][u32 firstGestureId][u32 secondGestureId][u32 combinedGestureId]
```

This allows creating complex gestures like:
- **Simultaneous**: Pinch + Rotate for image manipulation
- **Sequenced**: Long press then drag for reordering
- **Exclusive**: Tap or long press (whichever happens first)

**Opcode: COMBINE_GESTURES (0x0B)**

**Payload:**
```
[u8 combinationType][u32 firstGestureId][u32 secondGestureId][u32 combinedGestureId]
```

**Binary Layout:**
```
0B  CombinationType(1B)  FirstID(4B)  SecondID(4B)  CombinedID(4B)
```

**Example:** Combine pinch and rotate simultaneously
```
0B 00 01 00 00 00 02 00 00 00 03 00 00 00
```
Breakdown:
- `0B` - COMBINE_GESTURES opcode
- `00` - combinationType = SIMULTANEOUS
- `01 00 00 00` - firstGestureId = 1 (pinch)
- `02 00 00 00` - secondGestureId = 2 (rotate)
- `03 00 00 00` - combinedGestureId = 3

---

### Gesture Payload Details

#### TAP Gesture

**States:** BEGAN, ENDED

**Payload (BEGAN):**
```
[f32 startX][f32 startY]
```

**Payload (ENDED):**
```
[f32 startX][f32 startY][f32 locationX][f32 locationY][u8 tapCount]
```

**Example:** Tap began at (100, 200)
```
10 00 00 C8 42 00 00 34 43
```
- gestureType = TAP (0x10)
- gestureState = BEGAN (0x00)
- startX = 100.0
- startY = 200.0

**Example:** Tap ended at (105, 205) with tapCount=1
```
10 02 00 00 C8 42 00 00 34 43 00 00 CD 42 00 00 39 43 01
```
- gestureType = TAP (0x10)
- gestureState = ENDED (0x02)
- startX = 100.0
- startY = 200.0
- locationX = 105.0
- locationY = 205.0
- tapCount = 1

---

#### LONG_PRESS Gesture

**States:** BEGAN, CHANGED, ENDED, CANCELLED

**Payload (BEGAN):**
```
[f32 startX][f32 startY]
```

**Payload (CHANGED):**
```
[f32 startX][f32 startY][f32 locationX][f32 locationY][f32 duration]
```

**Payload (ENDED):**
```
[f32 startX][f32 startY][f32 locationX][f32 locationY][f32 duration][f32 pressure]
```

**Payload (CANCELLED):**
```
[f32 startX][f32 startY][f32 locationX][f32 locationY][f32 duration]
```

---

#### DRAG Gesture

**States:** BEGAN, CHANGED, ENDED, CANCELLED

**Payload (BEGAN):**
```
[f32 startX][f32 startY]
```

**Payload (CHANGED):**
```
[f32 startX][f32 startY][f32 locationX][f32 locationY][f32 translationX][f32 translationY][f32 velocityX][f32 velocityY]
```

**Payload (ENDED):**
```
[f32 startX][f32 startY][f32 locationX][f32 locationY][f32 translationX][f32 translationY][f32 velocityX][f32 velocityY]
```

**Payload (CANCELLED):**
```
[f32 startX][f32 startY][f32 locationX][f32 locationY][f32 translationX][f32 translationY]
```

**Fields:**
- `startX`, `startY`: Initial touch/mouse position
- `locationX`, `locationY`: Current position
- `translationX`, `translationY`: Distance from start (current - start)
- `velocityX`, `velocityY`: Current velocity in points per second

---

#### SWIPE Gesture

**States:** BEGAN, CHANGED, ENDED, CANCELLED

**Payload (BEGAN):**
```
[f32 startX][f32 startY]
```

**Payload (CHANGED):**
```
[f32 startX][f32 startY][f32 locationX][f32 locationY][f32 translationX][f32 translationY][f32 velocity]
```

**Payload (ENDED):**
```
[f32 startX][f32 startY][f32 locationX][f32 locationY][f32 translationX][f32 translationY][f32 velocity][u8 direction]
```

**Payload (CANCELLED):**
```
[f32 startX][f32 startY][f32 locationX][f32 locationY][f32 translationX][f32 translationY]
```

**Direction Enum:**
- 0x00 = LEFT
- 0x01 = RIGHT
- 0x02 = UP
- 0x03 = DOWN

---

#### PINCH Gesture

**States:** BEGAN, CHANGED, ENDED, CANCELLED

**Payload:**
```
[f32 startScale][f32 scale][f32 velocity][f32 startLocationX][f32 startLocationY]
```

**Fields:**
- `startScale`: Scale when gesture began (typically 1.0)
- `scale`: Current scale relative to start (1.0 = no change, 2.0 = doubled)
- `velocity`: Current scale velocity
- `startLocationX`, `startLocationY`: Midpoint of the pinch when it began

---

#### ROTATE Gesture

**States:** BEGAN, CHANGED, ENDED, CANCELLED

**Payload:**
```
[f32 startRotation][f32 rotation][f32 velocity][f32 startLocationX][f32 startLocationY]
```

**Fields:**
- `startRotation`: Rotation in radians when gesture began
- `rotation`: Current rotation in radians relative to start
- `velocity`: Current rotation velocity in radians per second
- `startLocationX`, `startLocationY`: Center point of rotation when it began

---

## Renderer Expectations for Colors

Renderers MUST adhere to the following color handling requirements:

1. **sRGB Interpretation**: All literal sRGB colors MUST be interpreted using the sRGB color space (IEC 61966-2-1) with D65 white point and standard sRGB transfer function.

2. **Color Space Conversion**: When the target display or rendering API uses a different color space (e.g., Display P3), renderers SHOULD convert sRGB colors to the native color space using platform-appropriate conversion methods.

3. **Semantic Token Resolution**: Semantic color tokens MUST be resolved according to the renderer's current theme, accessibility settings, and platform conventions. Token resolution may vary between light mode, dark mode, and high contrast modes.

4. **Alpha Handling**: Alpha values (0x00-0xFF) MUST be interpreted as 8-bit unsigned integers where 0x00 represents fully transparent and 0xFF represents fully opaque. Intermediate values represent proportional transparency.

5. **No Visual Guarantee**: The protocol guarantees consistent color **definition** but does NOT guarantee perceptually identical visual appearance across all physical displays due to differences in display gamuts, gamma, calibration, and viewing conditions.

6. **Fallback for Unknown Tokens**: If a renderer encounters an unknown semantic color token ID, it SHOULD fall back to a sensible default (e.g., black for text tokens, transparent for surface tokens) and log a warning for debugging.

---

## Design Token System

### Overview

The Pathland protocol implements a **design token system** as the foundation of all theming and visual styling. This system ensures a clean separation between:

- **Application**: Defines structure, semantic state, and token overrides
- **Renderer**: Defines visual appearance, interaction behaviors, and theme resolution

**Core Principle:** The protocol defines structure and semantic state only. Visual appearance is fully derived from design tokens in the renderer.

### Responsibilities

#### Application (Worker)
- Defines UI structure (tree mutations)
- Defines semantic state (role, enabled, selected, etc.)
- Optionally overrides design token values globally
- Emits mutation stream to renderer

#### Protocol
- Carries structure + semantic state + token overrides only
- Does NOT carry visual rules or interaction styling
- Supports DESIGN_TOKEN value type for referencing tokens
- Supports SET_DESIGN_TOKEN opcode for token overrides

#### Renderer
- Owns design token definitions and default values
- Resolves tokens into concrete visual properties
- Defines interaction state behaviors (hover, active, focus, etc.)
- Applies theme logic based on component semantics
- Renders components with appropriate styling

### Token Categories

Design tokens are organized into categories representing different visual primitives:

#### 1. Color Tokens
Tokens for color values used throughout the UI.

| Token Path | Description |
|------------|-------------|
| `color.primary` | Primary brand/accent color |
| `color.secondary` | Secondary color |
| `color.background` | Primary background color |
| `color.surface` | Surface/secondary background color |
| `color.text.primary` | Primary text color |
| `color.text.secondary` | Secondary text color |
| `color.text.tertiary` | Tertiary text color |
| `color.accent` | Accent color for interactive elements |
| `color.danger` | Danger/error state color |
| `color.success` | Success state color |
| `color.warning` | Warning state color |
| `color.info` | Informational state color |
| `color.border` | Border color |
| `color.separator` | Separator/divider color |

#### 2. Typography Tokens
Tokens for font styling.

| Token Path | Description |
|------------|-------------|
| `font.body` | Body text font |
| `font.heading.1` - `font.heading.6` | Heading fonts |
| `font.mono` | Monospace font |
| `font.size.body` | Body text size |
| `font.size.heading.1` - `font.size.heading.6` | Heading sizes |
| `font.weight.body` | Body text weight |
| `font.weight.heading` | Heading weight |
| `font.lineHeight.body` | Body text line height |

#### 3. Spacing Tokens
Tokens for spacing values.

| Token Path | Description |
|------------|-------------|
| `space.0` | Zero spacing (0px) |
| `space.1` - `space.12` | Incremental spacing values |
| `space.xs` | Extra small spacing |
| `space.sm` | Small spacing |
| `space.md` | Medium spacing |
| `space.lg` | Large spacing |
| `space.xl` | Extra large spacing |

#### 4. Shape Tokens
Tokens for border radius and shape values.

| Token Path | Description |
|------------|-------------|
| `radius.none` | No radius (0px) |
| `radius.sm` | Small radius |
| `radius.md` | Medium radius |
| `radius.lg` | Large radius |
| `radius.full` | Full radius (pill shape) |

#### 5. Elevation Tokens
Tokens for shadow/elevation values.

| Token Path | Description |
|------------|-------------|
| `elevation.none` | No elevation |
| `elevation.low` | Low elevation |
| `elevation.medium` | Medium elevation |
| `elevation.high` | High elevation |

### Token Resolution

#### Renderer-Owned Default Theme
Each renderer MUST provide a default theme implementation that includes:
- Default token values for all standard tokens
- Mapping of tokens to platform-specific rendering primitives
- Default interaction state behaviors

Example default mappings:
- `color.primary` → Platform accent color
- `color.background` → Platform background color
- `font.body` → Platform default font
- `space.1` → Platform-standard spacing unit

#### Application Token Overrides
Applications can override token values globally using the SET_DESIGN_TOKEN opcode. These overrides apply to all components that reference the token.

#### Token Inheritance and Derivation
Renderers MAY derive additional token values from base tokens. For example:
- `color.onPrimary` (text color on primary background) derived from `color.primary`
- `color.primary.hover` (hover state color) derived from `color.primary`
- `color.primary.active` (active state color) derived from `color.primary`

### Interaction States (Renderer Responsibility)

The following states are explicitly **renderer-owned** and MUST NOT be represented in the protocol as styling instructions:

- **Hover**: Mouse pointer over component
- **Active/Pressed**: Component is being pressed/activated
- **Focus**: Component has keyboard focus
- **Keyboard Focus Ring**: Visual indicator of focus state
- **Pointer Down/Up Transitions**: Animation during press/release
- **Disabled Visual Treatment**: Visual appearance when disabled

These states are managed by the renderer's theme system, which maps them to appropriate token variations.

#### Example: Button Interaction States

**Protocol Input (Application):**
```
CREATE_NODE id=10 type=BUTTON
SET_PROP id=10 role=PRIMARY
SET_PROP id=10 enabled=true
```

**Renderer Interpretation:**
- Normal: background = `color.primary`, text = `color.onPrimary`
- Hover: background = derived(`color.primary`, hoverModifier)
- Active: background = derived(`color.primary`, pressedModifier)
- Disabled: background = `color.disabledSurface`, opacity = disabledOpacity

No additional protocol communication is required for these state changes.

### Design Token Value Encoding

Design tokens are referenced by their path string using the DESIGN_TOKEN value type (0x08).

**Token Path Format:**
- Dot-separated: `category.tokenName`
- Case-sensitive (lowercase recommended)
- Examples: `color.primary`, `space.2`, `font.body`, `radius.medium`

**Binary Encoding:**
```
[u8 valueType=0x08][u32 pathLength][utf8 path...]
```

### Component Rendering Model

Components render based on:

1. **Structural Definition**: Tree mutations (CREATE_NODE, INSERT_CHILD, etc.)
2. **Semantic Properties**: Role, state, enabled, selected, etc.
3. **Design Tokens**: Resolved by renderer based on component semantics

### Protocol Constraints

**The protocol MUST NEVER describe:**
- How something looks in different interaction states
- Visual transitions or animations
- Conditional styling rules
- Platform-specific rendering details

**The protocol MAY describe:**
- What the component is (type)
- What semantic role it has (role)
- What logical state it is in (enabled, disabled, selected)
- Design token overrides (global values)

### Forward Compatibility

This token system allows:
- New components to be introduced without protocol changes
- New token categories to be added without breaking changes
- Theme variations to be supported at renderer level
- Platform-specific conventions to be respected

---

## Component Type Definitions

### Component Type Table

| Component | ID | Description |
|-----------|----|-------------|
| HSTACK | 0x0001 | Horizontal stack container |
| VSTACK | 0x0002 | Vertical stack container |
| TEXT | 0x0003 | Text display component |
| BUTTON | 0x0004 | Button component |
| IMAGE | 0x0005 | Image display component |
| SWITCH | 0x0006 | Toggle switch component |
| TEXT_FIELD | 0x0007 | Text input field component |
| SPACER | 0x0008 | Flexible space that expands to fill available space |

### Reserved Component Types

| Range | Purpose |
|-------|---------|
| 0x0009-0x7FFF | Future core components |
| 0x8000-0xFFFF | Custom/experimental components |

Implementations SHOULD ignore nodes with unknown component types.

---

## Semantic Properties

Semantic properties describe the intent and state of components, allowing renderers to apply appropriate visual styling based on design tokens.

### Global Semantic Properties (All Components)

| Property | ID | Value Type | Description |
|----------|----|------------|-------------|
| `role` | 0x2001 | ENUM | Semantic role of the component |
| `state` | 0x2002 | ENUM | Current state of the component |
| `enabled` | 0x2003 | U8 | Whether the component is enabled (0=false, 1=true) |
| `selected` | 0x2004 | U8 | Whether the component is selected (0=false, 1=true) |

### Role Enum

| Value | ID | Description | Applicable Components |
|-------|----|-------------|---------------------|
| DEFAULT | 0x00 | Default role | All |
| PRIMARY | 0x01 | Primary action/importance | BUTTON, TEXT |
| SECONDARY | 0x02 | Secondary action | BUTTON |
| DESTRUCTIVE | 0x03 | Destructive action | BUTTON |
| TERTIARY | 0x04 | Tertiary importance | TEXT |
| HEADING | 0x05 | Heading text | TEXT |
| BODY | 0x06 | Body text | TEXT |
| CAPTION | 0x07 | Caption text | TEXT |
| LABEL | 0x08 | Label text | TEXT |

### State Enum

| Value | ID | Description | Notes |
|-------|----|-------------|-------|
| NORMAL | 0x00 | Default state | |
| HOVER | 0x01 | Hover state | Set by renderer, not application |
| ACTIVE | 0x02 | Active/pressed state | Set by renderer, not application |
| FOCUS | 0x03 | Focus state | Set by renderer, not application |
| DISABLED | 0x04 | Disabled state | Can be set by application |
| LOADING | 0x05 | Loading state | |

**Important:** Interaction states (HOVER, ACTIVE, FOCUS) are managed by the renderer based on user input. The application should only set logical states (DISABLED, LOADING, etc.).

### Button-Specific Properties

| Property | ID | Value Type | Description |
|----------|----|------------|-------------|
| `icon` | 0x2101 | DESIGN_TOKEN | Icon token reference |

### Text Field-Specific Properties

| Property | ID | Value Type | Description |
|----------|----|------------|-------------|
| `placeholder` | 0x2201 | STRING | Placeholder text |
| `value` | 0x2202 | STRING | Current text value |

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
| `contentMargins` | 0x0005 | F32 or DESIGN_TOKEN | Internal margins around children within the stack |

### TEXT Properties

| Property | ID | Value Type | Description |
|----------|----|------------|-------------|
| `text` | 0x000A | STRING | Text content |
| `lineLimit` | 0x000B | U32 | Maximum number of lines (0 = unlimited) |
| `textAlignment` | 0x000C | ENUM | Text alignment |
| `truncationMode` | 0x000D | ENUM | Text truncation mode for overflow |
| `lineSpacing` | 0x000E | F32 | Additional space between lines in points |
| `baselineOffset` | 0x000F | F32 | Baseline offset in points (positive = down, negative = up) |

### Style Properties

Style properties can be applied to any component. Properties that accept COLOR can also accept DESIGN_TOKEN for token-based styling.

| Property | ID | Value Type | Description |
|----------|----|------------|-------------|
| `backgroundColor` | 0x1001 | COLOR or DESIGN_TOKEN | Background color (sRGB, semantic token, or design token) |
| `backgroundOpacity` | 0x1002 | F32 | Opacity (0.0 to 1.0) |
| `borderWidth` | 0x1003 | F32 or DESIGN_TOKEN | Border width (pixels or spacing token) |
| `borderColor` | 0x1004 | COLOR or DESIGN_TOKEN | Border color (sRGB, semantic token, or design token) |
| `borderRadius` | 0x1005 | F32 or DESIGN_TOKEN | Border radius (pixels or shape token) |
| `padding` | 0x1006 | F32 or DESIGN_TOKEN | Uniform padding (pixels or spacing token) |
| `fontSize` | 0x1007 | F32 or DESIGN_TOKEN | Font size (points or typography token) |
| `fontWeight` | 0x1008 | ENUM or DESIGN_TOKEN | Font weight (enum or typography token) |
| `fontFamily` | 0x1009 | STRING or DESIGN_TOKEN | Font family name or typography token |
| `color` | 0x100A | COLOR or DESIGN_TOKEN | Text color (sRGB, semantic token, or design token) |
| `width` | 0x100B | F32 | Width in points (-1.0 = fill, -2.0 = hug content) |
| `height` | 0x100C | F32 | Height in points (-1.0 = fill, -2.0 = hug content) |
| `opacity` | 0x100D | F32 | Opacity value (0.0 = transparent, 1.0 = opaque) |
| `visible` | 0x100E | U8 | Visibility (0 = hidden, 1 = visible) |
| `zIndex` | 0x100F | F32 | Stacking order (higher values appear on top) |
| `clipsToBounds` | 0x1010 | U8 | Clip content that overflows (0 = false, 1 = true) |

### Reserved Property IDs

| Range | Purpose |
|-------|---------|
| 0x0000 | Reserved |
| 0x0004 | Reserved (unused HSTACK/VSTACK slot) |
| 0x0006-0x0009 | Future HSTACK/VSTACK properties |
| 0x0010-0x0FFF | Future TEXT properties |
| 0x1011-0xFFFF | Future style properties |

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

### TruncationMode Enum

Used for `truncationMode` property on TEXT.

| Value | ID | Description |
|-------|----|-------------|
| HEAD | 0x00 | Truncate at head (ellipsis at start): "...Hello" |
| MIDDLE | 0x01 | Truncate in middle: "Hel...lo" |
| TAIL | 0x02 | Truncate at tail: "Hello..." |
| CLIP | 0x03 | Clip without ellipsis |

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

---

## Complete Examples

### Example 1: Creating a Simple UI

This creates a VStack with a Text child displaying "Hello":

```
# Message Header
01 00          # version = 1
03 00 00 00    # instructionCount = 3 (reduced from 5)

# Instruction 1: CREATE_NODE (VSTACK with ID 1, no properties)
01 01 00 00 00 02 00 00    # nodeId=1, type=VSTACK, propertyCount=0

# Instruction 2: CREATE_NODE (TEXT with ID 2, with inline properties)
01 02 00 00 00 03 00 02    # nodeId=2, type=TEXT, propertyCount=2
0A 00                 # propertyId=TEXT (0x000A)
05                     # valueType=STRING (0x05)
05 00 00 00            # string length=5
48 65 6C 6C 6F         # "Hello"
07 10                 # propertyId=FONT_SIZE (0x1007)
04                     # valueType=F32 (0x04)
00 00 80 41           # value=24.0 (f32: 0x41800000 in LE)

# Instruction 3: INSERT_CHILD (node 2 into node 1 at index 0)
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
        const propertyCount = view.getUint8(cursor);
        cursor += 1;
        const properties = [];
        for (let i = 0; i < propertyCount; i++) {
          const propertyId = view.getUint16(cursor, true);
          cursor += 2;
          const valueType = view.getUint8(cursor);
          cursor += 1;
          let value;
          switch (valueType) {
            case 0x01: value = view.getUint8(cursor); cursor += 1; break;
            case 0x02: value = view.getUint32(cursor, true); cursor += 4; break;
            case 0x03: value = view.getInt32(cursor, true); cursor += 4; break;
            case 0x04: value = view.getFloat32(cursor, true); cursor += 4; break;
            case 0x05: 
              const strLen = view.getUint32(cursor, true); cursor += 4;
              value = new TextDecoder().decode(buffer.subarray(cursor, cursor + strLen));
              cursor += strLen; break;
            case 0x06: value = view.getUint8(cursor); cursor += 1; break;
            default: throw new Error(`Unknown value type: ${valueType}`);
          }
          properties.push({ propertyId, valueType, value });
        }
        instructions.push({ opcode: 'CREATE_NODE', nodeId, componentType, properties });
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
2. Accept messages with version 2
3. Handle all defined opcodes (1-6)
4. Handle all defined component types (1-7)
5. Handle all defined property IDs
6. Use little-endian byte order
7. Use the specified encoding for all types
8. Implement design token system as specified
9. Provide default theme with token mappings

A conforming implementation MAY:

1. Support additional opcodes
2. Support additional component types
3. Support additional property IDs
4. Support additional value types
5. Optimize encoding/decoding for their platform
6. Support other transport mechanisms
7. Provide custom design token categories
8. Extend theme system with platform-specific behaviors

---

## Appendix A: Constant Reference

### Opcodes

```
CREATE_NODE = 0x01
DELETE_NODE = 0x02
INSERT_CHILD = 0x03
REMOVE_CHILD = 0x04
SET_PROPERTY = 0x05
SET_DESIGN_TOKEN = 0x06
DISPATCH_EVENT = 0x07
REGISTER_EVENT_HANDLER = 0x08
GESTURE_UPDATE = 0x09
ATTACH_GESTURE = 0x0A
COMBINE_GESTURES = 0x0B
```

### Event Types

```
TAP = 0x01
DOUBLE_TAP = 0x02
LONG_PRESS = 0x03
CLICK = 0x04
HOVER = 0x05
FOCUS = 0x06
BLUR = 0x07
KEY_DOWN = 0x08
KEY_UP = 0x09
SCROLL = 0x0A
SWIPE = 0x0B
ON_APPEAR = 0x0C
ON_DISAPPEAR = 0x0D
ON_CHANGE = 0x0E
```

### Event Phases

```
CAPTURE = 0x00
TARGET = 0x01
BUBBLE = 0x02
ANY_PHASE = 0xFF
```

### Button Types

```
LEFT = 0x00
RIGHT = 0x01
MIDDLE = 0x02
BACK = 0x03
FORWARD = 0x04
```

### Modifier Keys

```
SHIFT = 0x01
CONTROL = 0x02
ALT = 0x04
META = 0x08
```

### Swipe Directions

```
LEFT = 0x00
RIGHT = 0x01
UP = 0x02
DOWN = 0x03
```

### Gesture Types

```
TAP_GESTURE = 0x10
LONG_PRESS_GESTURE = 0x11
DRAG_GESTURE = 0x12
SWIPE_GESTURE = 0x13
PINCH_GESTURE = 0x14
ROTATE_GESTURE = 0x15
```

### Gesture States

```
GESTURE_BEGAN = 0x00
GESTURE_CHANGED = 0x01
GESTURE_ENDED = 0x02
GESTURE_CANCELLED = 0x03
```

### Gesture Combination Types

```
SIMULTANEOUS = 0x00
SEQUENCED = 0x01
EXCLUSIVE = 0x02
```

### Component Types

```
HSTACK = 0x0001
VSTACK = 0x0002
TEXT = 0x0003
BUTTON = 0x0004
IMAGE = 0x0005
SWITCH = 0x0006
TEXT_FIELD = 0x0007
SPACER = 0x0008
```

### HSTACK/VSTACK Properties

```
SPACING = 0x0001
ALIGNMENT = 0x0002
JUSTIFICATION = 0x0003
CONTENT_MARGINS = 0x0005
```

### TEXT Properties

```
TEXT = 0x000A
LINE_LIMIT = 0x000B
TEXT_ALIGNMENT = 0x000C
TRUNCATION_MODE = 0x000D
LINE_SPACING = 0x000E
BASELINE_OFFSET = 0x000F
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
WIDTH = 0x100B
HEIGHT = 0x100C
OPACITY = 0x100D
VISIBLE = 0x100E
Z_INDEX = 0x100F
CLIPS_TO_BOUNDS = 0x1010
```

### Semantic Properties

```
ROLE = 0x2001
STATE = 0x2002
ENABLED = 0x2003
SELECTED = 0x2004
```

### Button Properties

```
ICON = 0x2101
```

### Text Field Properties

```
PLACEHOLDER = 0x2201
VALUE = 0x2202
```

### Value Types

```
U8 = 0x01
U32 = 0x02
I32 = 0x03
F32 = 0x04
STRING = 0x05
ENUM = 0x06
COLOR = 0x07
DESIGN_TOKEN = 0x08
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

// TruncationMode
HEAD = 0x00
MIDDLE = 0x01
TAIL = 0x02
CLIP = 0x03

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

// Role
DEFAULT = 0x00
PRIMARY = 0x01
SECONDARY = 0x02
DESTRUCTIVE = 0x03
TERTIARY = 0x04
HEADING = 0x05
BODY = 0x06
CAPTION = 0x07
LABEL = 0x08

// State
NORMAL = 0x00
HOVER = 0x01
ACTIVE = 0x02
FOCUS = 0x03
DISABLED = 0x04
LOADING = 0x05

// Token Value Types
TOKEN_VALUE_COLOR = 0x0001
TOKEN_VALUE_F32 = 0x0002
TOKEN_VALUE_STRING = 0x0003
TOKEN_VALUE_U32 = 0x0004
```

### Color Constants

```
// Color Kind
SEMANTIC_TOKEN = 0x01
LITERAL_SRGB = 0x02

// Semantic Color Tokens
PRIMARY_TEXT = 0x0001
SECONDARY_TEXT = 0x0002
TERTIARY_TEXT = 0x0003
BACKGROUND = 0x0004
SURFACE = 0x0005
ACCENT = 0x0006
ERROR = 0x0007
SUCCESS = 0x0008
WARNING = 0x0009
INFO = 0x000A
BORDER = 0x000B
SEPARATOR = 0x000C
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
  SET_PROPERTY: 0x05,
  SET_DESIGN_TOKEN: 0x06,
  DISPATCH_EVENT: 0x07,
  REGISTER_EVENT_HANDLER: 0x08,
  GESTURE_UPDATE: 0x09,
  ATTACH_GESTURE: 0x0A,
  COMBINE_GESTURES: 0x0B
};

// Component Types
const COMPONENT_TYPES = {
  HSTACK: 0x0001,
  VSTACK: 0x0002,
  TEXT: 0x0003,
  BUTTON: 0x0004,
  IMAGE: 0x0005,
  SWITCH: 0x0006,
  TEXT_FIELD: 0x0007,
  SPACER: 0x0008
};

// Event Types
const EVENT_TYPES = {
  TAP: 0x01,
  DOUBLE_TAP: 0x02,
  LONG_PRESS: 0x03,
  CLICK: 0x04,
  HOVER: 0x05,
  FOCUS: 0x06,
  BLUR: 0x07,
  KEY_DOWN: 0x08,
  KEY_UP: 0x09,
  SCROLL: 0x0A,
  SWIPE: 0x0B,
  ON_APPEAR: 0x0C,
  ON_DISAPPEAR: 0x0D,
  ON_CHANGE: 0x0E
};

// Event Phases
const EVENT_PHASES = {
  CAPTURE: 0x00,
  TARGET: 0x01,
  BUBBLE: 0x02,
  ANY: 0xFF
};

// Button Types
const BUTTON_TYPES = {
  LEFT: 0x00,
  RIGHT: 0x01,
  MIDDLE: 0x02,
  BACK: 0x03,
  FORWARD: 0x04
};

// Modifier Keys (bit flags)
const MODIFIER_KEYS = {
  SHIFT: 0x01,
  CONTROL: 0x02,
  ALT: 0x04,
  META: 0x08
};

// Swipe Directions
const SWIPE_DIRECTIONS = {
  LEFT: 0x00,
  RIGHT: 0x01,
  UP: 0x02,
  DOWN: 0x03
};

// Gesture Types
const GESTURE_TYPES = {
  TAP: 0x10,
  LONG_PRESS: 0x11,
  DRAG: 0x12,
  SWIPE: 0x13,
  PINCH: 0x14,
  ROTATE: 0x15
};

// Gesture States
const GESTURE_STATES = {
  BEGAN: 0x00,
  CHANGED: 0x01,
  ENDED: 0x02,
  CANCELLED: 0x03
};

// Gesture Combination Types
const GESTURE_COMBINATIONS = {
  SIMULTANEOUS: 0x00,
  SEQUENCED: 0x01,
  EXCLUSIVE: 0x02
};

// Value Types
const VALUE_TYPES = {
  U8: 0x01,
  U32: 0x02,
  I32: 0x03,
  F32: 0x04,
  STRING: 0x05,
  ENUM: 0x06,
  COLOR: 0x07,
  DESIGN_TOKEN: 0x08
};

// Color Constants
const COLOR_KIND = {
  SEMANTIC_TOKEN: 0x01,
  LITERAL_SRGB: 0x02
};

const SEMANTIC_COLOR_TOKENS = {
  PRIMARY_TEXT: 0x0001,
  SECONDARY_TEXT: 0x0002,
  TERTIARY_TEXT: 0x0003,
  BACKGROUND: 0x0004,
  SURFACE: 0x0005,
  ACCENT: 0x0006,
  ERROR: 0x0007,
  SUCCESS: 0x0008,
  WARNING: 0x0009,
  INFO: 0x000A,
  BORDER: 0x000B,
  SEPARATOR: 0x000C
};

// Token Value Types (for SET_DESIGN_TOKEN)
const TOKEN_VALUE_TYPES = {
  COLOR: 0x0001,
  F32: 0x0002,
  STRING: 0x0003,
  U32: 0x0004
};

// Properties
const PROPERTIES = {
  // HSTACK/VSTACK
  SPACING: 0x0001,
  ALIGNMENT: 0x0002,
  JUSTIFICATION: 0x0003,
  CONTENT_MARGINS: 0x0005,
  
  // TEXT
  TEXT: 0x000A,
  LINE_LIMIT: 0x000B,
  TEXT_ALIGNMENT: 0x000C,
  TRUNCATION_MODE: 0x000D,
  LINE_SPACING: 0x000E,
  BASELINE_OFFSET: 0x000F,
  
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
  COLOR: 0x100A,
  // Frame/Size Control
  WIDTH: 0x100B,
  HEIGHT: 0x100C,
  OPACITY: 0x100D,
  VISIBLE: 0x100E,
  Z_INDEX: 0x100F,
  CLIPS_TO_BOUNDS: 0x1010,
  
  // Semantic Properties
  ROLE: 0x2001,
  STATE: 0x2002,
  ENABLED: 0x2003,
  SELECTED: 0x2004,
  
  // Button-specific
  ICON: 0x2101,
  
  // Text Field-specific
  PLACEHOLDER: 0x2201,
  VALUE: 0x2202
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

const TRUNCATION_MODE = {
  HEAD: 0x00,
  MIDDLE: 0x01,
  TAIL: 0x02,
  CLIP: 0x03
};

// Role Enum
const ROLE = {
  DEFAULT: 0x00,
  PRIMARY: 0x01,
  SECONDARY: 0x02,
  DESTRUCTIVE: 0x03,
  TERTIARY: 0x04,
  HEADING: 0x05,
  BODY: 0x06,
  CAPTION: 0x07,
  LABEL: 0x08
};

// State Enum
const STATE = {
  NORMAL: 0x00,
  HOVER: 0x01,
  ACTIVE: 0x02,
  FOCUS: 0x03,
  DISABLED: 0x04,
  LOADING: 0x05
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

  writeColor(colorValue) {
    // colorValue can be either a semantic token ID (number) or an rgba object/number
    if (typeof colorValue === 'number') {
      // For backward compatibility: assume it's a semantic token ID
      this.writeU8(COLOR_KIND.SEMANTIC_TOKEN);
      this.writeU16(colorValue);
    } else if (colorValue && typeof colorValue === 'object' && 'tokenId' in colorValue) {
      // Semantic token: { tokenId: number }
      this.writeU8(COLOR_KIND.SEMANTIC_TOKEN);
      this.writeU16(colorValue.tokenId);
    } else {
      // Literal sRGB: { r: number, g: number, b: number, a?: number } or packed rgba number
      let r, g, b, a = 255;
      if (colorValue && typeof colorValue === 'object') {
        r = colorValue.r ?? 0;
        g = colorValue.g ?? 0;
        b = colorValue.b ?? 0;
        a = colorValue.a ?? 255;
      } else {
        // Legacy: assume it's a packed RGBA number (0xAARRGGBB format)
        a = (colorValue >> 24) & 0xFF;
        r = (colorValue >> 16) & 0xFF;
        g = (colorValue >> 8) & 0xFF;
        b = colorValue & 0xFF;
      }
      this.writeU8(COLOR_KIND.LITERAL_SRGB);
      const rgba = (a << 24) | (r << 16) | (g << 8) | b;
      this.writeU32(rgba);
    }
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
        // Base: opcode + nodeId + componentType + propertyCount
        let size = 1 + 4 + 2 + 1;
        if (inst.properties) {
          for (const prop of inst.properties) {
            size += 2 + 1 + this.calculateValueSize(prop.valueType, prop.value);
          }
        }
        return size;
      case 'DELETE_NODE':
        return 1 + 4; // opcode + nodeId
      case 'INSERT_CHILD':
        return 1 + 4 + 4 + 4; // opcode + parentId + childId + index
      case 'REMOVE_CHILD':
        return 1 + 4 + 4; // opcode + parentId + childId
      case 'SET_PROPERTY':
        return 1 + 4 + 2 + 1 + this.calculateValueSize(inst.valueType, inst.value);
      case 'SET_DESIGN_TOKEN':
        return 1 + 4 + 2 + this.calculateTokenValueSize(inst.tokenValueType, inst.value);
      case 'DISPATCH_EVENT':
        // opcode + targetId + eventType + timestamp + phase + eventData
        return 1 + 4 + 1 + 4 + 1 + this.calculateEventDataSize(inst.eventType, inst.data);
      case 'REGISTER_EVENT_HANDLER':
        return 1 + 4 + 1 + 1 + 4; // opcode + nodeId + eventType + handlerPhase + handlerId
      case 'GESTURE_UPDATE':
        // opcode + targetId + gestureType + gestureState + timestamp + gestureId + gestureData
        return 1 + 4 + 1 + 1 + 4 + 4 + this.calculateGestureDataSize(inst.gestureType, inst.gestureState, inst.data);
      case 'ATTACH_GESTURE':
        // opcode + nodeId + gestureType + recognizerId + phase + 4 handler IDs
        return 1 + 4 + 1 + 4 + 1 + 4 + 4 + 4 + 4;
      case 'COMBINE_GESTURES':
        // opcode + combinationType + firstId + secondId + combinedId
        return 1 + 1 + 4 + 4 + 4;
      default:
        return 1; // opcode only (minimum)
    }
  }

  calculateGestureDataSize(gestureType, gestureState, data) {
    // Calculate size based on gesture type and state
    switch (gestureType) {
      case GESTURE_TYPES.TAP:
        if (gestureState === GESTURE_STATES.BEGAN) {
          return 4 + 4; // startX, startY
        } else if (gestureState === GESTURE_STATES.ENDED) {
          return 4 + 4 + 4 + 4 + 1; // startX, startY, locationX, locationY, tapCount
        }
        return 0;
      case GESTURE_TYPES.LONG_PRESS:
        if (gestureState === GESTURE_STATES.BEGAN) {
          return 4 + 4; // startX, startY
        } else if (gestureState === GESTURE_STATES.CHANGED) {
          return 4 + 4 + 4 + 4 + 4; // startX, startY, locationX, locationY, duration
        } else if (gestureState === GESTURE_STATES.ENDED) {
          return 4 + 4 + 4 + 4 + 4 + 4; // startX, startY, locationX, locationY, duration, pressure
        } else if (gestureState === GESTURE_STATES.CANCELLED) {
          return 4 + 4 + 4 + 4 + 4; // startX, startY, locationX, locationY, duration
        }
        return 0;
      case GESTURE_TYPES.DRAG:
      case GESTURE_TYPES.SWIPE:
        if (gestureState === GESTURE_STATES.BEGAN) {
          return 4 + 4; // startX, startY
        } else if (gestureState === GESTURE_STATES.CHANGED || gestureState === GESTURE_STATES.ENDED) {
          return 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4; // startX, startY, locationX, locationY, translationX, translationY, velocityX, velocityY
        } else if (gestureState === GESTURE_STATES.CANCELLED) {
          return 4 + 4 + 4 + 4 + 4 + 4; // startX, startY, locationX, locationY, translationX, translationY
        }
        return 0;
      case GESTURE_TYPES.PINCH:
      case GESTURE_TYPES.ROTATE:
        return 4 + 4 + 4 + 4 + 4; // startScale/rotation, scale/rotation, velocity, startLocationX, startLocationY
      default:
        return 0;
    }
  }

  calculateEventDataSize(eventType, data) {
    // Calculate size based on event type and data
    switch (eventType) {
      case EVENT_TYPES.TAP:
      case EVENT_TYPES.DOUBLE_TAP:
        return 4 + 4 + 1; // x, y, tapCount
      case EVENT_TYPES.LONG_PRESS:
        return 4 + 4 + 4 + 4; // x, y, duration, pressure
      case EVENT_TYPES.CLICK:
        return 4 + 4 + 1 + 1 + 1; // x, y, button, clickCount, modifiers
      case EVENT_TYPES.HOVER:
        return 1 + 4 + 4; // isHovering, x, y
      case EVENT_TYPES.FOCUS:
      case EVENT_TYPES.BLUR:
        return 1; // isFocused
      case EVENT_TYPES.KEY_DOWN:
        return 2 + 1 + 1; // keyCode, modifiers, repeat
      case EVENT_TYPES.KEY_UP:
        return 2 + 1; // keyCode, modifiers
      case EVENT_TYPES.SCROLL:
        return 4 + 4 + 4 + 4; // deltaX, deltaY, offsetX, offsetY
      case EVENT_TYPES.SWIPE:
        return 1 + 4 + 4; // direction, velocity, distance
      case EVENT_TYPES.ON_APPEAR:
      case EVENT_TYPES.ON_DISAPPEAR:
        return 0; // No data payload
      case EVENT_TYPES.ON_CHANGE:
        // propertyId + valueType + value
        if (data && data.propertyId) {
          return 2 + 1 + this.calculateValueSize(data.valueType, data.value);
        }
        return 0;
      default:
        return 0; // Unknown event type, no data
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
      case VALUE_TYPES.COLOR: return 1 + (value.tokenId !== undefined ? 2 : 4); // colorKind + (tokenId or rgba)
      case VALUE_TYPES.DESIGN_TOKEN: return 1 + 4 + value.length; // valueType + pathLength + path
      default: return 0;
    }
  }

  calculateTokenValueSize(tokenValueType, value) {
    switch (tokenValueType) {
      case TOKEN_VALUE_TYPES.COLOR: return 1 + (value.tokenId !== undefined ? 2 : 4); // colorKind + (tokenId or rgba)
      case TOKEN_VALUE_TYPES.F32: return 4;
      case TOKEN_VALUE_TYPES.STRING: return 4 + value.length;
      case TOKEN_VALUE_TYPES.U32: return 4;
      default: return 0;
    }
  }

  writeInstruction(inst) {
    this.writeU8(OPCODES[inst.opcode]);
    
    switch (inst.opcode) {
      case 'CREATE_NODE':
        this.writeU32(inst.nodeId);
        this.writeU16(inst.componentType);
        // Write property count and properties
        const properties = inst.properties || [];
        this.writeU8(properties.length);
        for (const prop of properties) {
          this.writeU16(prop.propertyId);
          this.writeU8(prop.valueType);
          this.writeValue(prop.valueType, prop.value);
        }
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
      case 'SET_DESIGN_TOKEN':
        this.writeU32(inst.tokenId);
        this.writeU16(inst.tokenValueType);
        this.writeTokenValue(inst.tokenValueType, inst.value);
        break;
      case 'DISPATCH_EVENT':
        this.writeU32(inst.targetId);
        this.writeU8(inst.eventType);
        this.writeU32(inst.timestamp ?? Date.now());
        this.writeU8(inst.phase ?? EVENT_PHASES.TARGET);
        this.writeEventData(inst.eventType, inst.data);
        break;
      case 'REGISTER_EVENT_HANDLER':
        this.writeU32(inst.nodeId);
        this.writeU8(inst.eventType);
        this.writeU8(inst.handlerPhase ?? EVENT_PHASES.TARGET);
        this.writeU32(inst.handlerId);
        break;
      case 'GESTURE_UPDATE':
        this.writeU32(inst.targetId);
        this.writeU8(inst.gestureType);
        this.writeU8(inst.gestureState);
        this.writeU32(inst.timestamp ?? Date.now());
        this.writeU32(inst.gestureId);
        this.writeGestureData(inst.gestureType, inst.gestureState, inst.data);
        break;
      case 'ATTACH_GESTURE':
        this.writeU32(inst.nodeId);
        this.writeU8(inst.gestureType);
        this.writeU32(inst.gestureRecognizerId);
        this.writeU8(inst.handlerPhase ?? EVENT_PHASES.TARGET);
        this.writeU32(inst.onBeganHandler ?? 0);
        this.writeU32(inst.onChangedHandler ?? 0);
        this.writeU32(inst.onEndedHandler ?? 0);
        this.writeU32(inst.onCancelledHandler ?? 0);
        break;
      case 'COMBINE_GESTURES':
        this.writeU8(inst.combinationType);
        this.writeU32(inst.firstGestureId);
        this.writeU32(inst.secondGestureId);
        this.writeU32(inst.combinedGestureId);
        break;
    }
  }

  writeGestureData(gestureType, gestureState, data) {
    data = data || {};
    switch (gestureType) {
      case GESTURE_TYPES.TAP:
        if (gestureState === GESTURE_STATES.BEGAN) {
          this.writeF32(data.startX ?? 0);
          this.writeF32(data.startY ?? 0);
        } else if (gestureState === GESTURE_STATES.ENDED) {
          this.writeF32(data.startX ?? 0);
          this.writeF32(data.startY ?? 0);
          this.writeF32(data.locationX ?? 0);
          this.writeF32(data.locationY ?? 0);
          this.writeU8(data.tapCount ?? 1);
        }
        break;
      case GESTURE_TYPES.LONG_PRESS:
        if (gestureState === GESTURE_STATES.BEGAN) {
          this.writeF32(data.startX ?? 0);
          this.writeF32(data.startY ?? 0);
        } else if (gestureState === GESTURE_STATES.CHANGED || gestureState === GESTURE_STATES.CANCELLED) {
          this.writeF32(data.startX ?? 0);
          this.writeF32(data.startY ?? 0);
          this.writeF32(data.locationX ?? 0);
          this.writeF32(data.locationY ?? 0);
          this.writeF32(data.duration ?? 0);
        } else if (gestureState === GESTURE_STATES.ENDED) {
          this.writeF32(data.startX ?? 0);
          this.writeF32(data.startY ?? 0);
          this.writeF32(data.locationX ?? 0);
          this.writeF32(data.locationY ?? 0);
          this.writeF32(data.duration ?? 0);
          this.writeF32(data.pressure ?? 0);
        }
        break;
      case GESTURE_TYPES.DRAG:
        if (gestureState === GESTURE_STATES.BEGAN) {
          this.writeF32(data.startX ?? 0);
          this.writeF32(data.startY ?? 0);
        } else if (gestureState === GESTURE_STATES.CHANGED || gestureState === GESTURE_STATES.ENDED) {
          this.writeF32(data.startX ?? 0);
          this.writeF32(data.startY ?? 0);
          this.writeF32(data.locationX ?? 0);
          this.writeF32(data.locationY ?? 0);
          this.writeF32(data.translationX ?? 0);
          this.writeF32(data.translationY ?? 0);
          this.writeF32(data.velocityX ?? 0);
          this.writeF32(data.velocityY ?? 0);
        } else if (gestureState === GESTURE_STATES.CANCELLED) {
          this.writeF32(data.startX ?? 0);
          this.writeF32(data.startY ?? 0);
          this.writeF32(data.locationX ?? 0);
          this.writeF32(data.locationY ?? 0);
          this.writeF32(data.translationX ?? 0);
          this.writeF32(data.translationY ?? 0);
        }
        break;
      case GESTURE_TYPES.SWIPE:
        if (gestureState === GESTURE_STATES.BEGAN) {
          this.writeF32(data.startX ?? 0);
          this.writeF32(data.startY ?? 0);
        } else if (gestureState === GESTURE_STATES.CHANGED || gestureState === GESTURE_STATES.CANCELLED) {
          this.writeF32(data.startX ?? 0);
          this.writeF32(data.startY ?? 0);
          this.writeF32(data.locationX ?? 0);
          this.writeF32(data.locationY ?? 0);
          this.writeF32(data.translationX ?? 0);
          this.writeF32(data.translationY ?? 0);
          this.writeF32(data.velocity ?? 0);
        } else if (gestureState === GESTURE_STATES.ENDED) {
          this.writeF32(data.startX ?? 0);
          this.writeF32(data.startY ?? 0);
          this.writeF32(data.locationX ?? 0);
          this.writeF32(data.locationY ?? 0);
          this.writeF32(data.translationX ?? 0);
          this.writeF32(data.translationY ?? 0);
          this.writeF32(data.velocity ?? 0);
          this.writeU8(data.direction ?? SWIPE_DIRECTIONS.LEFT);
        }
        break;
      case GESTURE_TYPES.PINCH:
        this.writeF32(data.startScale ?? 1);
        this.writeF32(data.scale ?? 1);
        this.writeF32(data.velocity ?? 0);
        this.writeF32(data.startLocationX ?? 0);
        this.writeF32(data.startLocationY ?? 0);
        break;
      case GESTURE_TYPES.ROTATE:
        this.writeF32(data.startRotation ?? 0);
        this.writeF32(data.rotation ?? 0);
        this.writeF32(data.velocity ?? 0);
        this.writeF32(data.startLocationX ?? 0);
        this.writeF32(data.startLocationY ?? 0);
        break;
    }
  }

  writeEventData(eventType, data) {
    switch (eventType) {
      case EVENT_TYPES.TAP:
      case EVENT_TYPES.DOUBLE_TAP:
        this.writeF32(data.x ?? 0);
        this.writeF32(data.y ?? 0);
        this.writeU8(data.tapCount ?? 1);
        break;
      case EVENT_TYPES.LONG_PRESS:
        this.writeF32(data.x ?? 0);
        this.writeF32(data.y ?? 0);
        this.writeF32(data.duration ?? 0);
        this.writeF32(data.pressure ?? 0);
        break;
      case EVENT_TYPES.CLICK:
        this.writeF32(data.x ?? 0);
        this.writeF32(data.y ?? 0);
        this.writeU8(data.button ?? BUTTON_TYPES.LEFT);
        this.writeU8(data.clickCount ?? 1);
        this.writeU8(data.modifiers ?? 0);
        break;
      case EVENT_TYPES.HOVER:
        this.writeU8(data.isHovering ? 1 : 0);
        this.writeF32(data.x ?? 0);
        this.writeF32(data.y ?? 0);
        break;
      case EVENT_TYPES.FOCUS:
      case EVENT_TYPES.BLUR:
        this.writeU8(data.isFocused ? 1 : 0);
        break;
      case EVENT_TYPES.KEY_DOWN:
        this.writeU16(data.keyCode ?? 0);
        this.writeU8(data.modifiers ?? 0);
        this.writeU8(data.repeat ? 1 : 0);
        break;
      case EVENT_TYPES.KEY_UP:
        this.writeU16(data.keyCode ?? 0);
        this.writeU8(data.modifiers ?? 0);
        break;
      case EVENT_TYPES.SCROLL:
        this.writeF32(data.deltaX ?? 0);
        this.writeF32(data.deltaY ?? 0);
        this.writeF32(data.contentOffsetX ?? 0);
        this.writeF32(data.contentOffsetY ?? 0);
        break;
      case EVENT_TYPES.SWIPE:
        this.writeU8(data.direction ?? SWIPE_DIRECTIONS.LEFT);
        this.writeF32(data.velocity ?? 0);
        this.writeF32(data.distance ?? 0);
        break;
      case EVENT_TYPES.ON_APPEAR:
      case EVENT_TYPES.ON_DISAPPEAR:
        // No data payload
        break;
      case EVENT_TYPES.ON_CHANGE:
        if (data && data.propertyId) {
          this.writeU16(data.propertyId);
          this.writeU8(data.valueType);
          this.writeValue(data.valueType, data.value);
        }
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
      case VALUE_TYPES.COLOR:
        this.writeColor(value);
        break;
      case VALUE_TYPES.DESIGN_TOKEN:
        this.writeDesignToken(value);
        break;
    }
  }

  writeDesignToken(tokenPath) {
    this.writeU8(VALUE_TYPES.DESIGN_TOKEN);
    this.writeString(tokenPath);
  }

  writeTokenValue(tokenValueType, value) {
    switch (tokenValueType) {
      case TOKEN_VALUE_TYPES.COLOR:
        this.writeColor(value);
        break;
      case TOKEN_VALUE_TYPES.F32:
        this.writeF32(value);
        break;
      case TOKEN_VALUE_TYPES.STRING:
        this.writeString(value);
        break;
      case TOKEN_VALUE_TYPES.U32:
        this.writeU32(value);
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
    const colorKind = this.readU8();
    
    if (colorKind === COLOR_KIND.SEMANTIC_TOKEN) {
      const tokenId = this.readU16();
      return { tokenId, kind: 'semantic' };
    } else if (colorKind === COLOR_KIND.LITERAL_SRGB) {
      const rgba = this.readU32();
      return {
        kind: 'literal',
        a: (rgba >> 24) & 0xFF,
        r: (rgba >> 16) & 0xFF,
        g: (rgba >> 8) & 0xFF,
        b: rgba & 0xFF
      };
    }
    
    // Unknown color kind - return null or error
    return null;
  }

  decodeInstruction() {
    const opcode = this.readU8();
    
    switch (opcode) {
      case OPCODES.CREATE_NODE: {
        const nodeId = this.readU32();
        const componentType = this.readU16();
        const propertyCount = this.readU8();
        const properties = [];
        for (let i = 0; i < propertyCount; i++) {
          const propertyId = this.readU16();
          const valueType = this.readU8();
          const value = this.readValue(valueType);
          properties.push({ propertyId, valueType, value });
        }
        return {
          opcode: 'CREATE_NODE',
          nodeId,
          componentType,
          properties
        };
      }
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
      case OPCODES.SET_PROPERTY: {
        const nodeId = this.readU32();
        const propertyId = this.readU16();
        const valueType = this.readU8();
        const value = this.readValue(valueType);
        return {
          opcode: 'SET_PROPERTY',
          nodeId,
          propertyId,
          valueType,
          value
        };
      }
      case OPCODES.SET_DESIGN_TOKEN: {
        const tokenId = this.readU32();
        const tokenValueType = this.readU16();
        const value = this.readTokenValue(tokenValueType);
        return {
          opcode: 'SET_DESIGN_TOKEN',
          tokenId,
          tokenValueType,
          value
        };
      }
      case OPCODES.DISPATCH_EVENT: {
        const targetId = this.readU32();
        const eventType = this.readU8();
        const timestamp = this.readU32();
        const phase = this.readU8();
        const data = this.readEventData(eventType);
        return {
          opcode: 'DISPATCH_EVENT',
          targetId,
          eventType,
          timestamp,
          phase,
          data
        };
      }
      case OPCODES.REGISTER_EVENT_HANDLER:
        return {
          opcode: 'REGISTER_EVENT_HANDLER',
          nodeId: this.readU32(),
          eventType: this.readU8(),
          handlerPhase: this.readU8(),
          handlerId: this.readU32()
        };
      case OPCODES.GESTURE_UPDATE: {
        const targetId = this.readU32();
        const gestureType = this.readU8();
        const gestureState = this.readU8();
        const timestamp = this.readU32();
        const gestureId = this.readU32();
        const data = this.readGestureData(gestureType, gestureState);
        return {
          opcode: 'GESTURE_UPDATE',
          targetId,
          gestureType,
          gestureState,
          timestamp,
          gestureId,
          data
        };
      }
      case OPCODES.ATTACH_GESTURE:
        return {
          opcode: 'ATTACH_GESTURE',
          nodeId: this.readU32(),
          gestureType: this.readU8(),
          gestureRecognizerId: this.readU32(),
          handlerPhase: this.readU8(),
          onBeganHandler: this.readU32(),
          onChangedHandler: this.readU32(),
          onEndedHandler: this.readU32(),
          onCancelledHandler: this.readU32()
        };
      case OPCODES.COMBINE_GESTURES:
        return {
          opcode: 'COMBINE_GESTURES',
          combinationType: this.readU8(),
          firstGestureId: this.readU32(),
          secondGestureId: this.readU32(),
          combinedGestureId: this.readU32()
        };
      default:
        // Unknown opcode - skip and continue
        return { opcode: 'UNKNOWN', opcodeValue: opcode };
    }
  }

  readGestureData(gestureType, gestureState) {
    switch (gestureType) {
      case GESTURE_TYPES.TAP:
        if (gestureState === GESTURE_STATES.BEGAN) {
          return {
            startX: this.readF32(),
            startY: this.readF32()
          };
        } else if (gestureState === GESTURE_STATES.ENDED) {
          return {
            startX: this.readF32(),
            startY: this.readF32(),
            locationX: this.readF32(),
            locationY: this.readF32(),
            tapCount: this.readU8()
          };
        }
        return {};
      case GESTURE_TYPES.LONG_PRESS:
        if (gestureState === GESTURE_STATES.BEGAN) {
          return {
            startX: this.readF32(),
            startY: this.readF32()
          };
        } else if (gestureState === GESTURE_STATES.CHANGED || gestureState === GESTURE_STATES.CANCELLED) {
          return {
            startX: this.readF32(),
            startY: this.readF32(),
            locationX: this.readF32(),
            locationY: this.readF32(),
            duration: this.readF32()
          };
        } else if (gestureState === GESTURE_STATES.ENDED) {
          return {
            startX: this.readF32(),
            startY: this.readF32(),
            locationX: this.readF32(),
            locationY: this.readF32(),
            duration: this.readF32(),
            pressure: this.readF32()
          };
        }
        return {};
      case GESTURE_TYPES.DRAG:
        if (gestureState === GESTURE_STATES.BEGAN) {
          return {
            startX: this.readF32(),
            startY: this.readF32()
          };
        } else if (gestureState === GESTURE_STATES.CHANGED || gestureState === GESTURE_STATES.ENDED) {
          return {
            startX: this.readF32(),
            startY: this.readF32(),
            locationX: this.readF32(),
            locationY: this.readF32(),
            translationX: this.readF32(),
            translationY: this.readF32(),
            velocityX: this.readF32(),
            velocityY: this.readF32()
          };
        } else if (gestureState === GESTURE_STATES.CANCELLED) {
          return {
            startX: this.readF32(),
            startY: this.readF32(),
            locationX: this.readF32(),
            locationY: this.readF32(),
            translationX: this.readF32(),
            translationY: this.readF32()
          };
        }
        return {};
      case GESTURE_TYPES.SWIPE:
        if (gestureState === GESTURE_STATES.BEGAN) {
          return {
            startX: this.readF32(),
            startY: this.readF32()
          };
        } else if (gestureState === GESTURE_STATES.CHANGED || gestureState === GESTURE_STATES.CANCELLED) {
          return {
            startX: this.readF32(),
            startY: this.readF32(),
            locationX: this.readF32(),
            locationY: this.readF32(),
            translationX: this.readF32(),
            translationY: this.readF32(),
            velocity: this.readF32()
          };
        } else if (gestureState === GESTURE_STATES.ENDED) {
          return {
            startX: this.readF32(),
            startY: this.readF32(),
            locationX: this.readF32(),
            locationY: this.readF32(),
            translationX: this.readF32(),
            translationY: this.readF32(),
            velocity: this.readF32(),
            direction: this.readU8()
          };
        }
        return {};
      case GESTURE_TYPES.PINCH:
        return {
          startScale: this.readF32(),
          scale: this.readF32(),
          velocity: this.readF32(),
          startLocationX: this.readF32(),
          startLocationY: this.readF32()
        };
      case GESTURE_TYPES.ROTATE:
        return {
          startRotation: this.readF32(),
          rotation: this.readF32(),
          velocity: this.readF32(),
          startLocationX: this.readF32(),
          startLocationY: this.readF32()
        };
      default:
        return {};
    }
  }

  readEventData(eventType) {
    switch (eventType) {
      case EVENT_TYPES.TAP:
      case EVENT_TYPES.DOUBLE_TAP:
        return {
          x: this.readF32(),
          y: this.readF32(),
          tapCount: this.readU8()
        };
      case EVENT_TYPES.LONG_PRESS:
        return {
          x: this.readF32(),
          y: this.readF32(),
          duration: this.readF32(),
          pressure: this.readF32()
        };
      case EVENT_TYPES.CLICK:
        return {
          x: this.readF32(),
          y: this.readF32(),
          button: this.readU8(),
          clickCount: this.readU8(),
          modifiers: this.readU8()
        };
      case EVENT_TYPES.HOVER:
        return {
          isHovering: this.readU8() === 1,
          x: this.readF32(),
          y: this.readF32()
        };
      case EVENT_TYPES.FOCUS:
      case EVENT_TYPES.BLUR:
        return {
          isFocused: this.readU8() === 1
        };
      case EVENT_TYPES.KEY_DOWN:
        return {
          keyCode: this.readU16(),
          modifiers: this.readU8(),
          repeat: this.readU8() === 1
        };
      case EVENT_TYPES.KEY_UP:
        return {
          keyCode: this.readU16(),
          modifiers: this.readU8()
        };
      case EVENT_TYPES.SCROLL:
        return {
          deltaX: this.readF32(),
          deltaY: this.readF32(),
          contentOffsetX: this.readF32(),
          contentOffsetY: this.readF32()
        };
      case EVENT_TYPES.SWIPE:
        return {
          direction: this.readU8(),
          velocity: this.readF32(),
          distance: this.readF32()
        };
      case EVENT_TYPES.ON_APPEAR:
      case EVENT_TYPES.ON_DISAPPEAR:
        return {}; // No data payload
      case EVENT_TYPES.ON_CHANGE:
        return {
          propertyId: this.readU16(),
          valueType: this.readU8(),
          value: this.readValue(this.readU8())
        };
      default:
        return null; // Unknown event type
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
      case VALUE_TYPES.COLOR: return this.readColor();
      case VALUE_TYPES.DESIGN_TOKEN: return this.readDesignToken();
      default: return null;
    }
  }

  readDesignToken() {
    // Read the token path string (already read the DESIGN_TOKEN type byte)
    return this.readString();
  }

  readTokenValue(tokenValueType) {
    switch (tokenValueType) {
      case TOKEN_VALUE_TYPES.COLOR: return this.readColor();
      case TOKEN_VALUE_TYPES.F32: return this.readF32();
      case TOKEN_VALUE_TYPES.STRING: return this.readString();
      case TOKEN_VALUE_TYPES.U32: return this.readU32();
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
  { opcode: 'CREATE_NODE', 
    nodeId: 2, 
    componentType: COMPONENT_TYPES.TEXT,
    properties: [
      { propertyId: PROPERTIES.TEXT, valueType: VALUE_TYPES.STRING, value: "Hello World" }
    ]
  },
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
      // Apply inline properties if present
      if (inst.properties) {
        for (const prop of inst.properties) {
          setProperty(inst.nodeId, prop.propertyId, prop.valueType, prop.value);
        }
      }
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
| **Version** | 2 |
| **Opcodes** | 11 defined, 121 reserved |
| **Component Types** | 8 defined, 32,761 reserved |
| **Properties** | 25 defined, 65,510 reserved |
| **Value Types** | 8 defined, 119 reserved |
| **Event Types** | 15 defined, 240 reserved |
| **Gesture Types** | 6 defined, 249 reserved |
| **Transport** | Transport-agnostic (ArrayBuffer) |

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0-alpha | 2026-06-25 | Initial custom binary protocol specification |
| 1.0.0-beta | 2026-06-26 | Added COLOR value type with semantic token and literal sRGB support, updated color properties to use COLOR type, added renderer expectations for colors |
| 2.0.0-alpha | 2026-06-26 | Added Design Token System: DESIGN_TOKEN value type, SET_DESIGN_TOKEN opcode, semantic component types (BUTTON, IMAGE, SWITCH, TEXT_FIELD), semantic properties (role, state, enabled, selected), comprehensive token categories and resolution rules |
| 2.1.0-alpha | 2026-06-26 | Added Event System Phase 1: DISPATCH_EVENT and REGISTER_EVENT_HANDLER opcodes, binary event encoding, ON_APPEAR (0x0C), ON_DISAPPEAR (0x0D), ON_CHANGE (0x0E) event types, event phase support (capture, target, bubble), comprehensive event payload definitions for all event types |
| 2.2.0-alpha | 2026-06-26 | Added Gesture System: GESTURE_UPDATE (0x09), ATTACH_GESTURE (0x0A), COMBINE_GESTURES (0x0B) opcodes, 6 gesture types (TAP, LONG_PRESS, DRAG, SWIPE, PINCH, ROTATE), gesture states (began, changed, ended, cancelled), gesture combination types (simultaneous, sequenced, exclusive), comprehensive binary encoding for all gesture states and data payloads |
