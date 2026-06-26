# Pathland Protocol Specification

**Version:** 2.0.0-alpha  
**Status:** Draft  
**Last Updated:** June 26, 2026

> **IMPORTANT**: This document provides an overview of Pathland's architecture and concepts. The **[BINARY_PROTOCOL.md](./BINARY_PROTOCOL.md)** specification is the **sole authoritative source** for all protocol implementation details including opcodes, component types, property IDs, value types, and binary encoding formats. Any JSON representations in this document are **illustrative only** and must not be used for implementation.

---

## Abstract

Pathland is a cross-platform, cross-language UI protocol inspired by SwiftUI, designed to enable retained-mode UI development with multiple renderer backends. This document defines the protocol specification independent of any specific runtime or programming language.

## 1. Introduction

### 1.1 Purpose

This specification defines a standardized protocol for describing user interfaces in a way that is:

- **Language-agnostic**: Can be implemented in any programming language
- **Platform-agnostic**: Can target any platform (web, mobile, embedded, desktop)
- **Renderer-agnostic**: Can be rendered by any compliant renderer
- **Extensible**: Can be extended with custom components and capabilities

### 1.2 Design Goals

1. **Simplicity**: Minimal core concepts with maximum expressiveness
2. **Portability**: Same UI description works across platforms
3. **Predictability**: Deterministic behavior regardless of implementation
4. **Extensibility**: Open for custom components and renderers
5. **Performance**: Efficient serialization and rendering
6. **Stateless Renderers**: Renderers are pure functions that do not maintain state

### 1.3 Core Principles

The following principles are **fundamental** to Pathland's design:

1. **Stateless Renderers**: Renderers MUST NOT maintain any internal state. A renderer is a pure function that takes command batches as input and produces render output. The renderer does not store, cache, or remember any application state between renders.

2. **State Ownership**: All application state (signals, computed values, etc.) is managed **externally** by the application or framework, not by the renderer.

3. **Component IDs for Event Routing**: The ONLY information a renderer retains between renders is the mapping of component IDs to their position in the rendered output, solely for the purpose of routing events back to the correct component in the application.

4. **Command-Based Protocol**: The protocol is **command-based**, not tree-based. Only actual changes are transmitted as commands.

### 1.4 Non-Goals

- Defining a specific runtime implementation
- Tying to a specific programming language
- Replacing low-level graphics protocols
- Supporting imperative UI paradigms

### 1.5 Conformance

A conforming Pathland implementation MUST:

1. Support all core component types defined in BINARY_PROTOCOL.md
2. Support all core opcodes defined in BINARY_PROTOCOL.md
3. Support the binary protocol format exactly as specified
4. Produce predictable and consistent rendering results

A conforming implementation MAY:

1. Add custom component types
2. Add custom opcodes (in the reserved ranges)
3. Add custom event types
4. Optimize rendering for specific platforms

---

## 2. Core Concepts

### 2.1 Command-Based Protocol

Pathland uses a **command-based** protocol where UI updates are described as a **list of commands** rather than a complete tree. This ensures only actual changes are transmitted.

**Command Types (Conceptual):**
- `create` - Create a new component (maps to CREATE_NODE opcode 0x01)
- `addChild` - Add a child to a parent component (maps to INSERT_CHILD opcode 0x03)
- `removeChild` - Remove a child from a parent component (maps to REMOVE_CHILD opcode 0x04)
- `setStyle` - Set or update a **visual style** property (background, border, color, font, padding, opacity) (maps to SET_PROPERTY opcode 0x05)
- `setProperty` - Set or update a **structural/layout** property (gap, alignment, justification, content, lineLimit, textAlignment, frame) (maps to SET_PROPERTY opcode 0x05)
- `setEventHandler` - Set an event handler on a component (maps to REGISTER_EVENT_HANDLER opcode 0x08)
- `destroy` - Destroy a component and its children (maps to DELETE_NODE opcode 0x02)

Each command is **stateless** - the renderer applies it without needing to understand the current state.

**For authoritative opcode definitions**, see **[BINARY_PROTOCOL.md - Opcode Definitions](./BINARY_PROTOCOL.md#opcode-definitions)**.

### 2.2 Stateless Command Execution

Pathland uses **stateless command execution**:

1. The application generates commands based on state changes
2. Commands are transmitted to the renderer as binary messages
3. The renderer executes each command in order
4. The renderer does NOT maintain the component tree between command batches
5. The renderer does NOT cache or remember any state

**Key Insight**: The renderer is a pure function that transforms a stream of commands into rendered output. It has no memory of previous commands or the current UI state.

### 2.3 Protocol Representation

The protocol is represented as a **custom binary instruction protocol**:

- **Binary**: The official format for transmission (see BINARY_PROTOCOL.md)
- **Native**: As native data structures in any language

This specification uses **pseudo-JSON** format for clarity in examples, but the **binary format** defined in BINARY_PROTOCOL.md is the only official protocol.

### 2.4 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PATHLAND COMMAND ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐  │
│  │   APPLICATION    │────▶│    COMMANDS      │────▶│    RENDERER     │  │
│  │   (State Mgmt)   │     │   (Binary Stream)│     │   (Stateless)   │  │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘  │
│           │                ┌────────────────────────┤                 │
│           │                 │ EVENTS (with Component IDs)              │
│           │                 └────────────────────────▶                 │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                   │
│  │   SIGNALS        │                                                   │
│  │   (State)        │                                                   │
│  └─────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────┘

KEY POINTS:
- State lives ONLY in the Application (Signals)
- Application generates COMMANDS as binary messages, not trees
- Renderer executes commands as a PURE FUNCTION
- Only actual changes are transmitted (efficient)
- Events flow: Platform → Renderer → Application (via Component IDs)
- Component IDs are the ONLY link between Renderer and Application
- Renderer maintains NO state between command batches
```

### 2.5 Data Flow

**Command Generation Flow (Application):**
```
State Change (Signals) 
    ↓
Application Determines What Changed 
    ↓
Generate Minimal Command List (as binary messages)
    ↓
Send Binary Commands to Renderer
```

**Command Execution Flow (Renderer):**
```
Receive Binary Command Batch 
    ↓
Decode Commands (using BINARY_PROTOCOL.md format)
    ↓
Execute Each Command (Create, Add, Set, Remove, etc.) 
    ↓
Update Rendered Output + ID→Element Map 
    ↓
Display to User
```

**Event Flow:**
```
User Interaction 
    ↓
Platform Event 
    ↓
Renderer Maps Event to Component ID (using current ID→Element map) 
    ↓
Application Receives Event with Component ID (as binary message)
    ↓
Application Updates State (Signals) 
    ↓
(Back to Command Generation Flow)
```

---

## 3. Command Protocol

### 3.1 Command Structure

**Official Protocol**: Pathland's **binary protocol** is the authoritative specification. See **[BINARY_PROTOCOL.md](./BINARY_PROTOCOL.md)** for complete details.

The binary protocol encodes UI tree mutations as a **linear stream of instructions** (bytecode) with the following characteristics:

- **Instruction-based**: Linear stream of opcodes with payloads
- **Numeric IDs**: Uses u8/u16/u32 identifiers for opcodes, types, and properties
- **Fixed-width types**: Uses fixed-width binary types (u8, u16, u32, i32, f32)
- **Little-endian**: All multi-byte values use little-endian byte order
- **Renderer-agnostic**: Only encodes tree mutations, no renderer-specific operations
- **Deterministic decoding**: Can be parsed linearly with a simple cursor
- **Forward compatible**: Supports adding new opcodes, types, and properties

**Note**: The conceptual command representation shown in this document has been **superseded** by the binary protocol. The binary protocol is the **only official protocol** for Pathland.

### 3.2 Binary Protocol Overview

See **[BINARY_PROTOCOL.md](./BINARY_PROTOCOL.md)** for the complete binary protocol specification.

#### 3.2.1 Message Format

```
[u16 version][u32 instructionCount][Instruction 1][Instruction 2]...[Instruction N]
```

- `version`: Protocol version (currently 1, u16, little-endian)
- `instructionCount`: Number of instructions in this message (u32, little-endian)
- Each instruction: `[u8 opcode][payload...]`

#### 3.2.2 Core Opcodes

| Opcode | Value | Description | Binary Format |
|--------|-------|-------------|---------------|
| CREATE_NODE | 0x01 | Create a new node | `[u8 opcode][u32 nodeId][u16 componentType][u8 propertyCount]...` |
| DELETE_NODE | 0x02 | Delete a node and its children | `[u8 opcode][u32 nodeId]` |
| INSERT_CHILD | 0x03 | Insert a child into a parent | `[u8 opcode][u32 parentId][u32 childId][u32 index]` |
| REMOVE_CHILD | 0x04 | Remove a child from a parent | `[u8 opcode][u32 parentId][u32 childId]` |
| SET_PROPERTY | 0x05 | Set a property on a node | `[u8 opcode][u32 nodeId][u16 propertyId][u8 valueType][value...]` |
| SET_DESIGN_TOKEN | 0x06 | Set a design token value globally | `[u8 opcode][u32 tokenId][u16 tokenValueType][value...]` |

#### 3.2.3 Event Opcodes

| Opcode | Value | Description | Binary Format |
|--------|-------|-------------|---------------|
| DISPATCH_EVENT | 0x07 | Dispatch an event to a component | `[u8 opcode][u32 targetId][u8 eventType][u32 timestamp][u8 phase]...` |
| REGISTER_EVENT_HANDLER | 0x08 | Register an event handler on a component | `[u8 opcode][u32 nodeId][u8 eventType][u8 handlerPhase][u32 handlerId]` |

#### 3.2.4 Gesture Opcodes

| Opcode | Value | Description | Binary Format |
|--------|-------|-------------|---------------|
| GESTURE_UPDATE | 0x09 | Dispatch a gesture state update | `[u8 opcode][u32 targetId][u8 gestureType][u8 gestureState][u32 timestamp][u32 gestureId]...` |
| ATTACH_GESTURE | 0x0A | Attach a gesture recognizer to a component | `[u8 opcode][u32 nodeId][u8 gestureType][u32 gestureRecognizerId][u8 handlerPhase][u32 onBeganHandler]...` |
| COMBINE_GESTURES | 0x0B | Combine two gestures | `[u8 opcode][u8 combinationType][u32 firstGestureId][u32 secondGestureId][u32 combinedGestureId]` |

#### 3.2.5 Component Types

| Component | ID (hex) | ID (decimal) | Description |
|-----------|----------|--------------|-------------|
| HSTACK | 0x0001 | 1 | Horizontal stack container |
| VSTACK | 0x0002 | 2 | Vertical stack container |
| TEXT | 0x0003 | 3 | Text display component |
| BUTTON | 0x0004 | 4 | Button component |
| IMAGE | 0x0005 | 5 | Image display component |
| SWITCH | 0x0006 | 6 | Toggle switch component |
| TEXT_FIELD | 0x0007 | 7 | Text input field component |
| SPACER | 0x0008 | 8 | Flexible space that expands to fill available space |

**Note**: See **[BINARY_PROTOCOL.md - Component Type Table](./BINARY_PROTOCOL.md#component-type-table)** for the complete list.

### 3.3 Command Batching

Commands (instructions) are sent in **batches** (messages) for efficiency:

```
Message:
[u16 version][u32 instructionCount]
[Instruction 1][Instruction 2]...[Instruction N]
```

**Batch Properties:**
- Instructions in a batch are executed in order
- The version field allows for protocol evolution
- Instruction count allows receivers to pre-allocate buffers

### 3.4 Command Execution Semantics

**Execution Rules:**
1. Instructions are executed in the order they are received
2. Each instruction is **idempotent** - executing it multiple times produces the same result
3. Instructions against non-existent components are **ignored** (not errors)
4. The renderer does NOT validate instruction sequences
5. The renderer does NOT maintain instruction history

**Example (Binary - CREATE_NODE for VSTACK):**
```
// Message header: version=1, instructionCount=1
01 00 01 00 00 00

// CREATE_NODE: nodeId=1, componentType=VSTACK (0x0002), propertyCount=0
01 01 00 00 00 02 00 00
```

**Example (Binary - CREATE_NODE for TEXT with content):**
```
// Message header: version=1, instructionCount=1
01 00 01 00 00 00

// CREATE_NODE: nodeId=2, componentType=TEXT (0x0003), propertyCount=1
01 02 00 00 00 03 00 01
// Property: propertyId=0x000A (text), valueType=0x05 (STRING), length=5, value="Hello"
0A 00 05 05 00 00 00 48 65 6C 6C 6F
```

See **[BINARY_PROTOCOL.md - Complete Examples](./BINARY_PROTOCOL.md#complete-examples)** for more details.

---

## 4. Binary Protocol

Pathland's **official binary protocol** is a **custom binary instruction protocol**. See:
- **[Binary Protocol Specification](./BINARY_PROTOCOL.md)** - Complete binary protocol documentation

**All conforming Pathland implementations MUST support this binary format.**

The binary protocol is the **authoritative specification** for Pathland. All other representations (JSON, etc.) in this document are for **illustrative purposes only** and may not reflect the current protocol.

### 4.1 Transport

The protocol is **transport-agnostic**. Binary messages can be sent over:
- WebSocket (ArrayBuffer)
- Web Workers (`postMessage` with transferable ArrayBuffer)
- IPC (raw bytes)
- Shared Memory
- Any transport that carries bytes

### 4.2 Usage Example

```javascript
// Application sends mutations to renderer
const instructions = [
  { opcode: 'CREATE_NODE', nodeId: 1, componentType: 0x0002 }, // VSTACK
  { opcode: 'CREATE_NODE', nodeId: 2, componentType: 0x0003 }, // TEXT
  { opcode: 'SET_PROPERTY', nodeId: 2, propertyId: 0x000A, valueType: 0x05, value: "Hello" },
  { opcode: 'INSERT_CHILD', parentId: 1, childId: 2, index: 0 }
];

const message = encodeMessage(instructions);
renderer.postMessage(message, [message]); // Transfer ownership
```

See **[BINARY_PROTOCOL.md](./BINARY_PROTOCOL.md)** for complete details including all opcodes, component types, properties, value types, and binary encoding formats.

---

## 5. Component System

> **IMPORTANT**: The component system is defined by the binary protocol. See **[BINARY_PROTOCOL.md - Component Type Definitions](./BINARY_PROTOCOL.md#component-type-definitions)** for the authoritative component specifications.

### 5.1 Component Definition

In the command-based protocol, components are created via the `CREATE_NODE` command with:
- `nodeId`: Unique identifier for the component (u32)
- `componentType`: Numeric type ID (u16, see Component Type Table)
- `properties`: Optional initial properties

**Note**: The component tree is a **logical concept** maintained by the **application**, not the renderer. The renderer only receives commands to create, modify, and destroy components.

### 5.2 Tree Structure (Application-Managed)

The **application** maintains the logical tree structure and generates appropriate commands:

- When a signal changes, the application determines which components need to be updated
- The application generates commands to update only those components
- The tree structure (parent-child relationships) is defined by `INSERT_CHILD` and `REMOVE_CHILD` commands
- The renderer does NOT maintain or understand the tree structure - it just executes commands

### 5.3 Component Types

This specification defines the following core component types:

| Type | Binary ID | Description | Can Have Children |
|------|-----------|-------------|-------------------|
| `HSTACK` | 0x0001 | Horizontal stack container | Yes |
| `VSTACK` | 0x0002 | Vertical stack container | Yes |
| `TEXT` | 0x0003 | Text display | No |
| `BUTTON` | 0x0004 | Button component | Yes |
| `IMAGE` | 0x0005 | Image display | No |
| `SWITCH` | 0x0006 | Toggle switch | No |
| `TEXT_FIELD` | 0x0007 | Text input field | No |
| `SPACER` | 0x0008 | Flexible space | No |

Implementations MAY define additional component types using IDs in the reserved ranges.

**For complete component specifications**, see **[COMPONENTS.md](./components/COMPONENTS.md)**.

### 5.4 Component IDs

Each component MUST have a unique `id` (nodeId) within its scope. The `id`:
- SHOULD be stable across renders
- MAY be used for event targeting and state management
- MAY be auto-generated if not provided
- Is transmitted as a u32 in the binary protocol

---

## 6. Layout System

### 6.1 Stack Layout

Both `HSTACK` and `VSTACK` use a flexible stack-based layout system.

#### 6.1.1 Common Stack Properties

| Property | Property ID (hex) | Value Type | Default | Description |
|----------|-------------------|------------|---------|-------------|
| `spacing` | 0x0001 | F32 | 0 | Space between children |
| `alignment` | 0x0002 | ENUM | CENTER | Alignment of children along the cross axis |
| `justification` | 0x0003 | ENUM | START | Distribution of children along the main axis |
| `contentMargins` | 0x0005 | F32 or DESIGN_TOKEN | 0 | Internal margins around children |

**For complete property definitions**, see **[BINARY_PROTOCOL.md - Property ID Definitions](./BINARY_PROTOCOL.md#property-id-definitions)**.

#### 6.1.2 Stack Alignment

`Alignment` values (for cross-axis):
- `0x00` = START (align to start/leading edge)
- `0x01` = CENTER
- `0x02` = END (align to end/trailing edge)
- `0x03` = STRETCH (fill available space)

For `HSTACK`:
- Cross axis is vertical (top to bottom)
- `alignment` controls vertical alignment of children

For `VSTACK`:
- Cross axis is horizontal (leading to trailing)
- `alignment` controls horizontal alignment of children

#### 6.1.3 Stack Justification

`Justification` values (for main-axis):
- `0x00` = START (pack at start)
- `0x01` = CENTER (center with equal space on both sides)
- `0x02` = END (pack at end)
- `0x03` = SPACE_BETWEEN (equal space between children, none at edges)
- `0x04` = SPACE_AROUND (equal space around children)
- `0x05` = SPACE_EVENLY (equal space between and around children)

### 6.2 Frame/Size Properties

All components support frame/size control properties:

| Property | Property ID (hex) | Value Type | Description |
|----------|-------------------|------------|-------------|
| `width` | 0x100B | F32 | Width in points (-1.0 = fill, -2.0 = hug content) |
| `height` | 0x100C | F32 | Height in points (-1.0 = fill, -2.0 = hug content) |

**Special Values:**
- `-1.0` = Fill available space
- `-2.0` = Hug content (size to fit)

### 6.3 Spacing Properties

All components support spacing properties:

| Property | Property ID (hex) | Value Type | Description |
|----------|-------------------|------------|-------------|
| `padding` | 0x1006 | F32 or DESIGN_TOKEN | Uniform padding |

### 6.4 Visibility Properties

All components support visibility properties:

| Property | Property ID (hex) | Value Type | Description |
|----------|-------------------|------------|-------------|
| `opacity` | 0x100D | F32 | Opacity (0.0 = transparent, 1.0 = opaque) |
| `visible` | 0x100E | U8 | Visibility (0 = hidden, 1 = visible) |

---

## 7. Text Component

### 7.1 Text Properties

| Property | Property ID (hex) | Value Type | Required | Default | Description |
|----------|-------------------|------------|----------|---------|-------------|
| `text` | 0x000A | STRING | Yes | - | Text content |
| `lineLimit` | 0x000B | U32 | No | 0 | Maximum number of lines (0 = unlimited) |
| `textAlignment` | 0x000C | ENUM | No | LEADING | Text alignment |
| `truncationMode` | 0x000D | ENUM | No | CLIP | How to truncate overflowing text |
| `lineSpacing` | 0x000E | F32 | No | 0 | Additional space between lines |
| `baselineOffset` | 0x000F | F32 | No | 0 | Baseline offset |

**TextAlignment Enum:**
- `0x00` = LEADING
- `0x01` = CENTER
- `0x02` = TRAILING

**TruncationMode Enum:**
- `0x00` = HEAD (ellipsis at start)
- `0x01` = MIDDLE
- `0x02` = TAIL (ellipsis at end)
- `0x03` = CLIP (no ellipsis)

### 7.2 Style Properties for Text

| Property | Property ID (hex) | Value Type | Description |
|----------|-------------------|------------|-------------|
| `color` | 0x100A | COLOR or DESIGN_TOKEN | Text color |
| `fontSize` | 0x1007 | F32 or DESIGN_TOKEN | Font size |
| `fontWeight` | 0x1008 | ENUM or DESIGN_TOKEN | Font weight |
| `fontFamily` | 0x1009 | STRING or DESIGN_TOKEN | Font family |

**FontWeight Enum:**
- `0x00` = ULTRA_LIGHT (100)
- `0x01` = THIN (200)
- `0x02` = LIGHT (300)
- `0x03` = REGULAR (400)
- `0x04` = MEDIUM (500)
- `0x05` = SEMIBOLD (600)
- `0x06` = BOLD (700)
- `0x07` = HEAVY (800)
- `0x08` = BLACK (900)

**For complete TEXT specifications**, see **[COMPONENTS.md - TEXT Component](./components/COMPONENTS.md#3-text-component-0x0003)**.

---

## 8. Event System

### 8.1 Event Types

Pathland defines the following core event types:

| Event Type | Binary ID (hex) | Description | Platforms |
|------------|-----------------|-------------|-----------|
| TAP | 0x01 | Single tap/click | All |
| DOUBLE_TAP | 0x02 | Double tap/click | All |
| LONG_PRESS | 0x03 | Long press | Touch |
| CLICK | 0x04 | Mouse click (with button info) | Desktop |
| HOVER | 0x05 | Mouse hover | Desktop |
| FOCUS | 0x06 | Focus gained | All |
| BLUR | 0x07 | Focus lost | All |
| KEY_DOWN | 0x08 | Key pressed | All |
| KEY_UP | 0x09 | Key released | All |
| SCROLL | 0x0A | Scroll action | All |
| SWIPE | 0x0B | Swipe gesture | Touch |
| ON_APPEAR | 0x0C | Component mounted | All |
| ON_DISAPPEAR | 0x0D | Component unmounted | All |
| ON_CHANGE | 0x0E | Property changed | All |

**For authoritative event system specifications**, see **[BINARY_PROTOCOL.md - Event System](./BINARY_PROTOCOL.md#event-system)** and **[EVENTS.md](./events/EVENTS.md)**.

### 8.2 Event Propagation

Events propagate according to the following rules:

1. **Capture Phase**: Event travels from root to target (optional)
2. **Target Phase**: Event reaches the target component
3. **Bubble Phase**: Event travels from target back to root

Event handlers can:
- **Stop propagation**: Prevent further handlers from being called
- **Stop immediate propagation**: Prevent other handlers on the same component from being called
- **Prevent default**: Prevent the default action associated with the event

---

## 9. State Management

### 9.1 Signals

Pathland uses **signals** for reactive state management. A signal:

- Holds a value that can change over time
- Notifies dependents when its value changes
- Can be read by components
- Can be written to trigger updates

**Signal Types:**
- `State Signal`: Mutable signal that can be set directly
- `Computed Signal`: Derived signal whose value is computed from other signals

**For complete state management specifications**, see **[STATE.md](./state/STATE.md)**.

---

## 10. Renderer Interface

### 10.1 Renderer Responsibilities

A Pathland renderer MUST:

1. Accept **binary command batches** as input (via BINARY_PROTOCOL.md format)
2. Execute commands as a **pure function** to produce rendered output
3. Handle events from the platform and dispatch them to the application via component IDs
4. Clean up resources when done

**Critical Constraint**: A renderer MUST NOT maintain any application state. The renderer is a stateless executor of commands.

### 10.2 Statelessness Principle

> **A Pathland renderer is a PURE FUNCTION: same commands → same output**

The renderer:
- ✅ Takes binary command batches as input
- ✅ Decodes commands using BINARY_PROTOCOL.md format
- ✅ Executes commands in order to produce rendered output
- ✅ Dispatches events to the application using component IDs
- ❌ Does NOT store application state
- ❌ Does NOT maintain a component tree
- ❌ Does NOT maintain a virtual DOM or similar internal representation
- ❌ Does NOT cache or remember signal values between command batches
- ❌ Does NOT validate command sequences

The ONLY exception is that a renderer MAY maintain a temporary mapping of component IDs to rendered elements **solely for the purpose of event routing**. This mapping must be:
- Rebuilt as commands are executed (not persisted across command batches)
- Used only to route events back to the correct component ID
- Not used to store any application state or data

### 10.3 State Management Clarification

**All state is managed EXTERNALLY to the renderer.**

- Signals and their values are managed by the application/framework
- The application generates commands based on state changes
- The renderer receives and executes commands without understanding state
- The renderer does not participate in state management

### 10.4 Command Execution Process

The command execution process follows this stateless model:

1. **Application State Change**: Application updates signal values
2. **Command Generation**: Application generates minimal command list based on changes
3. **Command Encoding**: Application encodes commands as binary messages using BINARY_PROTOCOL.md
4. **Command Transmission**: Application sends binary command batch to renderer
5. **Command Decoding**: Renderer decodes binary messages using BINARY_PROTOCOL.md
6. **Command Execution**: Renderer executes each command in order
7. **Renderer Output**: Renderer updates rendered output and ID→Element Map
8. **Event Dispatch**: Platform events are mapped to component IDs and sent to application as binary messages
9. **Application Handling**: Application receives event with component ID, updates state
10. **Repeat**: Back to step 1

**Key Insight**: The renderer has no memory between command batches. Each batch is executed independently.

---

## 11. Design Token System

### 11.1 Overview

The Pathland protocol implements a **design token system** as the foundation of all theming and visual styling.

**Core Principle:** The protocol defines structure and semantic state only. Visual appearance is fully derived from design tokens in the renderer.

**Responsibilities:**
- **Application**: Defines structure, semantic state, and token overrides
- **Protocol**: Carries structure + semantic state + token overrides only
- **Renderer**: Owns design token definitions, resolves tokens into concrete visuals, defines interaction state behaviors

**For complete design token specifications**, see **[BINARY_PROTOCOL.md - Design Token System](./BINARY_PROTOCOL.md#design-token-system)**.

### 11.2 Token Categories

| Category | Description | Examples |
|----------|-------------|----------|
| Color Tokens | Color values | `color.primary`, `color.text.primary` |
| Typography Tokens | Font styling | `font.body`, `font.size.body` |
| Spacing Tokens | Spacing values | `space.1`, `space.md` |
| Shape Tokens | Border radius | `radius.small`, `radius.medium` |
| Elevation Tokens | Shadow/elevation | `elevation.low`, `elevation.high` |

### 11.3 Token Value Type

The `DESIGN_TOKEN` value type (0x08) represents a reference to a design token by its path:

```
[u8 valueType=0x08][u32 pathLength][utf8 path...]
```

Token path examples: `color.primary`, `font.body`, `space.2`, `radius.medium`

---

## 12. Color System

### 12.1 Color Value Type

The `COLOR` value type (0x07) is a **tagged union** that supports both semantic color tokens and literal sRGB colors.

**Color Kind:**
- `0x01` = SEMANTIC_TOKEN (u16 tokenId follows)
- `0x02` = LITERAL_SRGB (u32 rgba follows)

### 12.2 Semantic Color Tokens

| Token | ID (hex) | Description |
|-------|----------|-------------|
| PRIMARY_TEXT | 0x0001 | Primary text color (adapts to light/dark mode) |
| SECONDARY_TEXT | 0x0002 | Secondary text color |
| TERTIARY_TEXT | 0x0003 | Tertiary text color |
| BACKGROUND | 0x0004 | Primary background color |
| SURFACE | 0x0005 | Surface/secondary background color |
| ACCENT | 0x0006 | Accent color for interactive elements |
| ERROR | 0x0007 | Error state color |
| SUCCESS | 0x0008 | Success state color |
| WARNING | 0x0009 | Warning state color |
| INFO | 0x000A | Informational state color |
| BORDER | 0x000B | Border color |
| SEPARATOR | 0x000C | Separator/divider color |

### 12.3 Literal sRGB Colors

Literal colors are encoded as **sRGB** with packed RGBA format:

- **Color Space**: sRGB (IEC 61966-2-1)
- **White Point**: D65
- **Transfer Function**: Standard sRGB gamma
- **Encoding**: Packed RGBA (32-bit, little-endian)
- **Bit Layout**: 0xAARRGGBB (stored as [BB][GG][RR][AA] in little-endian)

**Examples:**
- Opaque Red: 0xFFFF0000 → bytes `00 00 FF FF`
- Opaque Blue: 0xFF0000FF → bytes `FF 00 00 FF`
- 50% Transparent Red: 0x80FF0000 → bytes `00 00 FF 80`

**For complete color specifications**, see **[BINARY_PROTOCOL.md - Color Value Type](./BINARY_PROTOCOL.md#color-value-type)**.

---

## 13. Protocol Extensions

### 13.1 Custom Components

Implementations MAY define custom component types using IDs in the reserved ranges:
- `0x0009-0x7FFF`: Future core components
- `0x8000-0xFFFF`: Custom/experimental components

Custom components:
- MUST have a unique type ID
- SHOULD document their properties and behavior
- MAY have custom properties
- MAY be ignored by renderers that don't support them

### 13.2 Custom Properties

Implementations MAY define custom properties for existing components. Custom properties:
- MUST use IDs in the reserved ranges (0x1011-0xFFFF for style properties)
- SHOULD document their behavior
- MAY be ignored by renderers that don't support them

---

## 14. Compliance

### 14.1 Conformance Testing

A conforming implementation MUST pass all conformance tests defined by the Pathland working group.

### 14.2 Versioning

This protocol uses semantic versioning (Major.Minor.Patch):
- **Major**: Breaking changes
- **Minor**: Backward-compatible new features
- **Patch**: Backward-compatible bug fixes

### 14.3 Feature Detection

Implementations SHOULD provide a way to detect supported features at runtime.

---

## Appendix A: Quick Reference

For complete and authoritative protocol details, always refer to:

- **[BINARY_PROTOCOL.md](./BINARY_PROTOCOL.md)** - The official protocol specification
- **[COMPONENTS.md](./components/COMPONENTS.md)** - Component specifications
- **[EVENTS.md](./events/EVENTS.md)** - Event system specifications
- **[STATE.md](./state/STATE.md)** - State management specifications

---

## Appendix B: Revision History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0-alpha | June 26, 2026 | Updated to reference BINARY_PROTOCOL.md as authoritative; added consistency disclaimers |
| 1.0.0-alpha | 2024 | Initial draft |

---

**Note**: This document provides an overview of Pathland concepts. The **[BINARY_PROTOCOL.md](./BINARY_PROTOCOL.md)** specification is the **sole authoritative source** for all protocol implementation details.