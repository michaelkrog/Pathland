# Pathland Protocol Specification

**Version:** 1.0.0-alpha  
**Status:** Draft  
**Last Updated:** 2024  

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

1. **Stateless Renderers**: Renderers MUST NOT maintain any internal state. A renderer is a pure function that takes a component tree as input and produces render output. The renderer does not store, cache, or remember any application state between renders.

2. **State Ownership**: All application state (signals, computed values, etc.) is managed **externally** by the application or framework, not by the renderer.

3. **Component IDs for Event Routing**: The ONLY information a renderer retains between renders is the mapping of component IDs to their position in the rendered output, solely for the purpose of routing events back to the correct component in the application.

### 1.3 Non-Goals

- Defining a specific runtime implementation
- Tying to a specific programming language
- Replacing low-level graphics protocols
- Supporting imperative UI paradigms

### 1.4 Conformance

A conforming Pathland implementation MUST:

1. Support all core component types defined in this specification
2. Support all core layout modifiers
3. Support all core style properties
4. Support the event system as defined
5. Produce predictable and consistent rendering results

A conforming implementation MAY:

1. Add custom component types
2. Add custom layout modifiers
3. Add custom style properties
4. Add custom event types
5. Optimize rendering for specific platforms

## 2. Core Concepts

### 2.1 Command-Based Protocol

Pathland uses a **command-based** protocol where UI updates are described as a **list of commands** rather than a complete tree. This ensures only actual changes are transmitted.

**Command Types:**
- `create` - Create a new component
- `addChild` - Add a child to a parent component
- `removeChild` - Remove a child from a parent component
- `setStyle` - Set or update a **visual style** property (background, border, color, font, padding, opacity)
- `setProperty` - Set or update a **structural/layout** property (gap, alignment, justification, content, lineLimit, textAlignment, frame)
- `setEventHandler` - Set an event handler on a component
- `destroy` - Destroy a component and its children

Each command is **stateless** - the renderer applies it without needing to understand the current state.

### 2.2 Stateless Command Execution

Pathland uses **stateless command execution**:

1. The application generates commands based on state changes
2. Commands are transmitted to the renderer
3. The renderer executes each command in order
4. The renderer does NOT maintain the component tree between command batches
5. The renderer does NOT cache or remember any state

**Key Insight**: The renderer is a pure function that transforms a stream of commands into rendered output. It has no memory of previous commands or the current UI state.

### 2.3 Protocol Representation

The protocol can be represented in multiple formats:

- **JSON**: For serialization and network transmission
- **Binary**: For efficient inter-process communication
- **Native**: As native data structures in any language

This specification uses a **pseudo-JSON** format for clarity, but implementations are free to use any internal representation.

### 2.4 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PATHLAND COMMAND ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐  │
│  │   APPLICATION    │────▶│    COMMANDS      │────▶│    RENDERER     │  │
│  │   (State Mgmt)   │     │   (Create, Add,   │     │   (Stateless)   │  │
│  └─────────────────┘     │    Set, Remove)  │     └─────────────────┘  │
│           │                └─────────────────┘              │              │
│           │                       │                        │              │
│           │ Generate Commands      │ Execute Commands       │              │
│           │ from State Changes    │ (Pure Function)        │              │
│           ▼                       ▼                        ▼              │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐  │
│  │   SIGNALS        │     │   COMMAND         │     │   PLATFORM      │  │
│  │   (State)        │     │   STREAM          │     │   (DOM/Native/   │  │
│  └─────────────────┘     └─────────────────┘     │   Graphics)      │  │
│                              ┌────────────────────────┤                 │
│                              │ EVENTS (with Component IDs)              │
│                              └────────────────────────▶                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────┘

KEY POINTS:
- State lives ONLY in the Application (Signals)
- Application generates COMMANDS, not trees
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
Generate Minimal Command List 
    ↓
Send Commands to Renderer
```

**Command Execution Flow (Renderer):**
```
Receive Command Batch 
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
Application Receives Event with Component ID 
    ↓
Application Updates State (Signals) 
    ↓
(Back to Command Generation Flow)
```

## 3. Command Protocol

### 3.1 Command Structure

All commands share a common structure:

```json
{
  "type": <CommandType>,
  "target": <string>,  // Component ID this command affects
  "data": { ... }      // Command-specific data
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | The command type |
| `target` | string | Yes | The ID of the component this command affects |
| `data` | object | No | Command-specific data |

### 3.2 Command Types

#### 3.2.1 Create Command

Creates a new component.

```json
{
  "type": "create",
  "target": "new-component-id",
  "data": {
    "componentType": "hstack" | "vstack" | "text" | <CustomType>,
    "modifiers": { ... },
    "events": { ... }
  }
}
```

**Fields:**
- `componentType`: The type of component to create
- `modifiers`: Initial modifiers for the component (optional)
- `events`: Initial event handlers for the component (optional)

#### 3.2.2 Add Child Command

Adds a child to a parent component.

```json
{
  "type": "addChild",
  "target": "parent-component-id",
  "data": {
    "childId": "child-component-id",
    "index": <number>  // Optional: index to insert at (defaults to end)
  }
}
```

**Fields:**
- `childId`: The ID of the child component to add (must already exist)
- `index`: The position to insert the child (optional, defaults to appending)

#### 3.2.3 Remove Child Command

Removes a child from a parent component.

```json
{
  "type": "removeChild",
  "target": "parent-component-id",
  "data": {
    "childId": "child-component-id"
  }
}
```

#### 3.2.4 Set Style Command

Sets or updates a **visual style** property on a component.

```json
{
  "type": "setStyle",
  "target": "component-id",
  "data": {
    "property": "background" | "border" | "color" | "font" | "padding" | "opacity",
    "value": <StyleValue>
  }
}
```

**Style Properties** (visual appearance only):
- `background`: Background styling (color, gradient, image, opacity)
- `border`: Border styling (width, color, radius, style)
- `color`: Text color
- `font`: Font styling (family, size, weight, style, etc.)
- `padding`: Inner padding
- `opacity`: Overall opacity

#### 3.2.5 Set Property Command

Sets or updates a **structural/layout** property on a component.

```json
{
  "type": "setProperty",
  "target": "component-id",
  "data": {
    "property": "gap" | "alignment" | "justification" | "content" | "lineLimit" | "textAlignment" | "frame",
    "value": <PropertyValue>
  }
}
```

**Property Categories:**

**Stack Properties (hstack, vstack):**
- `gap`: Space between children
- `alignment`: Cross-axis alignment (leading, center, trailing)
- `justification`: Main-axis distribution (leading, center, trailing, spaceBetween, spaceAround, spaceEvenly)

**Text Properties:**
- `content`: The text to display
- `lineLimit`: Maximum number of lines
- `textAlignment`: Text alignment (leading, center, trailing)

**Universal Properties:**
- `frame`: Size constraints (width, height, min/max dimensions)

**Note**: The `content` property for text components is set using `setProperty` with property `"content"`.

#### 3.2.6 Set Event Handler Command

Sets or updates an event handler on a component.

```json
{
  "type": "setEventHandler",
  "target": "component-id",
  "data": {
    "event": "onTap" | "onClick" | "onHover" | <AnyEvent>,
    "handler": <HandlerReference>
  }
}
```

#### 3.2.7 Destroy Command

Destroys a component and all its children.

```json
{
  "type": "destroy",
  "target": "component-id",
  "data": {}
}
```

**Behavior:**
- Removes the component and all its descendants from the UI
- Cleans up any resources associated with the component
- Any future commands referencing destroyed components or their children are ignored

### 3.3 Command Batching

Commands are typically sent in **batches** to reduce overhead:

```json
{
  "batchId": <string | number>,  // Optional batch identifier
  "commands": [
    { "type": "create", "target": "btn1", "data": { "componentType": "text", "content": "Click me" } },
    { "type": "setStyle", "target": "btn1", "data": { "property": "background", "value": { "color": "#007AFF" } } },
    { "type": "setEventHandler", "target": "btn1", "data": { "event": "onTap", "handler": "handleClick" } },
    { "type": "addChild", "target": "root", "data": { "childId": "btn1" } }
  ]
}
```

**Batch Properties:**
- Commands in a batch are executed in order
- Batches are atomic: either all commands succeed or none do (implementation-defined)
- Batch IDs can be used for debugging and acknowledgment

### 3.4 Command Execution Semantics

**Execution Rules:**
1. Commands are executed in the order they are received
2. Each command is **idempotent** - executing it multiple times produces the same result
3. Commands against non-existent components are **ignored** (not errors)
4. The renderer does NOT validate command sequences
5. The renderer does NOT maintain command history

**Example:**
```json
// These commands create and style a button:
["create hstack with id=container"]
["create text with id=label"]
["setProperty on label: content=Hello"]
["setStyle on label: font={size: 24}"]
["addChild: add label to container"]
```

## 3. Binary Protocol

Pathland's **official binary protocol** is a **custom binary instruction protocol**. See:
- **[Binary Protocol Specification](./BINARY_PROTOCOL.md)** - Complete binary protocol documentation

All conforming Pathland implementations **MUST** support this binary format.

### 3.1 Protocol Overview

The protocol encodes **UI tree mutations** as a **linear stream of instructions** (bytecode). It is:

- **Instruction-based**: Linear stream of opcodes with payloads
- **Numeric IDs**: Uses u8/u16/u32 identifiers for opcodes, types, and properties
- **Fixed-width types**: Uses fixed-width binary types (u8, u16, u32, i32, f32)
- **Renderer-agnostic**: Only encodes tree mutations, no renderer-specific operations
- **Deterministic decoding**: Can be parsed linearly with a simple cursor
- **Forward compatible**: Supports adding new opcodes, types, and properties

### 3.2 Message Format

```
[u16 version][u32 instructionCount][Instruction 1][Instruction 2]...[Instruction N]
```

### 3.3 Instruction Types

| Opcode | Value | Description |
|--------|-------|-------------|
| CREATE_NODE | 0x01 | Create a new node |
| DELETE_NODE | 0x02 | Delete a node and its children |
| INSERT_CHILD | 0x03 | Insert a child into a parent |
| REMOVE_CHILD | 0x04 | Remove a child from a parent |
| SET_PROPERTY | 0x05 | Set a property on a node |

### 3.4 Component Types

| Component | ID |
|-----------|----|
| HSTACK | 0x0001 |
| VSTACK | 0x0002 |
| TEXT | 0x0003 |

### 3.5 Transport

The protocol is **transport-agnostic**. Messages can be sent over:
- WebSocket (ArrayBuffer)
- Web Workers (`postMessage` with transferable ArrayBuffer)
- IPC (raw bytes)
- Shared Memory
- Any transport that carries bytes

### 3.6 Usage Example

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

See **[BINARY_PROTOCOL.md](./BINARY_PROTOCOL.md)** for complete details.

---

## 4. Data Types

### 4.1 Primitive Types

| Type | Description | Examples |
|------|-------------|----------|
| `string` | UTF-8 text | `"hello"`, `"Arial"` |
| `number` | 64-bit floating point | `42`, `3.14`, `-10` |
| `boolean` | True or false | `true`, `false` |
| `null` | Absence of value | `null` |

### 4.2 Composite Types

#### 4.2.1 Length

A `Length` represents a measurement value. It can be:

- **Absolute**: A numeric value in logical pixels
- **Relative**: A percentage string
- **Auto**: The value `"auto"` for automatic sizing

```json
// Examples:
42          // 42 pixels
"50%"      // 50 percent
"auto"     // automatic
```

#### 4.2.2 Color

A `Color` represents a color value. Implementations SHOULD support at minimum:

- **Hex**: `"#RRGGBB"` or `"#RRGGBBAA"`
- **RGB**: `"rgb(R, G, B)"` or `"rgba(R, G, B, A)"`
- **Named**: Platform-defined named colors (e.g., `"red"`, `"blue"`)

```json
// Examples:
"#FF0000"        // Red (opaque)
"#FF000080"      // Red (50% opacity)
"rgb(255, 0, 0)" // Red
"rgba(255,0,0,0.5)" // Red with 50% opacity
"systemRed"      // Platform-specific named color
```

#### 4.2.3 Point

A `Point` represents a 2D coordinate.

```json
{
  "x": <number>,
  "y": <number>
}
```

#### 4.2.4 Size

A `Size` represents width and height dimensions.

```json
{
  "width": <Length>,
  "height": <Length>
}
```

#### 4.2.5 Rect

A `Rect` represents a rectangle defined by origin and size.

```json
{
  "origin": <Point>,
  "size": <Size>
}
```

#### 4.2.6 Edge Insets

`EdgeInsets` define padding or margins for each edge.

```json
{
  "top": <Length>,
  "right": <Length>,
  "bottom": <Length>,
  "left": <Length>
}
```

Shorthand forms MAY be supported:

```json
// Uniform insets
42

// Horizontal and vertical
{
  "horizontal": 10,
  "vertical": 20
}

// All edges
{
  "all": 10
}
```

## 4. Component System

**Note**: In the command-based protocol, the "component tree" is a **logical concept** maintained by the **application**, not the renderer. The renderer only receives commands to create, modify, and destroy components.

### 4.1 Component Definition

When a component is created via the `create` command, it has the following structure:

```json
{
  "componentType": <string>,
  "modifiers": { ... },
  "events": { ... }
}
```

**Note**: The `id` is specified in the `target` field of the create command, not in the component data itself.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `componentType` | string | Yes | Component type (e.g., "hstack", "vstack", "text") |
| `modifiers` | object | No | Initial layout and style modifiers |
| `events` | object | No | Initial event handlers |

### 4.2 Tree Structure (Application-Managed)

The **application** maintains the logical tree structure and generates appropriate commands:

- When a signal changes, the application determines which components need to be updated
- The application generates commands to update only those components
- The tree structure (parent-child relationships) is defined by `addChild` and `removeChild` commands
- The renderer does NOT maintain or understand the tree structure - it just executes commands

### 4.3 Component Types

This specification defines the following core component types:

| Type | Description | Can Have Children |
|------|-------------|-------------------|
| `hstack` | Horizontal stack container | Yes |
| `vstack` | Vertical stack container | Yes |
| `text` | Text display | No |

Implementations MAY define additional component types.

### 4.4 Component IDs

Each component MUST have a unique `id` within its scope. The `id`:
- SHOULD be stable across renders
- MAY be used for event targeting and state management
- MAY be auto-generated if not provided

## 5. Layout System

### 5.1 Stack Layout

Both `hstack` and `vstack` use a flexible stack-based layout system.

#### 5.1.1 Common Stack Modifiers

| Modifier | Type | Default | Description |
|----------|------|---------|-------------|
| `gap` | Length | 0 | Space between children |
| `alignment` | StackAlignment | "center" | Alignment of children along the cross axis |
| `justification` | StackJustification | "leading" | Distribution of children along the main axis |
| `padding` | EdgeInsets | 0 | Inner padding |
| `border` | BorderStyle | none | Border styling |
| `background` | BackgroundStyle | none | Background styling |

#### 5.1.2 Stack Alignment

`StackAlignment` values:

- `"leading"` / `"top"` - Align to the start/leading edge
- `"center"` - Align to the center
- `"trailing"` / `"bottom"` - Align to the end/trailing edge

For `hstack`:
- Cross axis is vertical (top to bottom)
- `alignment` controls vertical alignment of children

For `vstack`:
- Cross axis is horizontal (leading to trailing)
- `alignment` controls horizontal alignment of children

#### 5.1.3 Stack Justification

`StackJustification` values:

- `"leading"` - Children packed at the start
- `"center"` - Children centered with equal space on both sides
- `"trailing"` - Children packed at the end
- `"spaceBetween"` - Equal space between children, none at edges
- `"spaceAround"` - Equal space around children (half at edges)
- `"spaceEvenly"` - Equal space between and around children

### 5.2 Frame Modifiers

All components support frame modifiers for sizing:

```json
{
  "frame": {
    "width": <Length>,
    "height": <Length>,
    "minWidth": <Length>,
    "maxWidth": <Length>,
    "minHeight": <Length>,
    "maxHeight": <Length>,
    "alignment": <Alignment>
  }
}
```

`Alignment` for frame:

```json
{
  "horizontal": "leading" | "center" | "trailing",
  "vertical": "top" | "center" | "bottom"
}
```

## 6. Style System

### 6.1 Border Style

```json
{
  "border": {
    "width": <Length>,
    "color": <Color>,
    "radius": <Length> | <CornerRadii>,
    "style": "solid" | "dotted" | "dashed" | "double"
  }
}
```

`CornerRadii`:

```json
{
  "topLeft": <Length>,
  "topRight": <Length>,
  "bottomLeft": <Length>,
  "bottomRight": <Length>
}
```

### 6.2 Background Style

```json
{
  "background": {
    "color": <Color>,
    "gradient": <Gradient>,
    "image": <BackgroundImage>,
    "opacity": <number>
  }
}
```

`Gradient`:

```json
// Linear gradient
{
  "type": "linear",
  "direction": "toBottom" | "toRight" | <number>,
  "stops": [
    {"position": <number>, "color": <Color>},
    ...
  ]
}

// Radial gradient
{
  "type": "radial",
  "center": <Point>,
  "radius": <number>,
  "stops": [
    {"position": <number>, "color": <Color>},
    ...
  ]
}
```

`BackgroundImage`:

```json
{
  "source": <string>,
  "size": "cover" | "contain" | "stretch" | <Size>,
  "position": "center" | "top" | "bottom" | "left" | "right" | <Point>,
  "repeat": "noRepeat" | "repeat" | "repeatX" | "repeatY"
}
```

## 7. Text Component

### 7.1 Text Structure

```json
{
  "type": "text",
  "content": <string>,
  "modifiers": {
    "font": <FontStyle>,
    "lineLimit": <number> | null,
    "textAlignment": "leading" | "center" | "trailing",
    "color": <Color>,
    "truncationMode": "clip" | "head" | "tail" | "middle",
    "lineBreakMode": "wordWrap" | "characterWrap" | "clip" | "headTruncation" | "tailTruncation" | "middleTruncation"
  }
}
```

### 7.2 Font Style

```json
{
  "family": <string> | [<string>],
  "size": <number>,
  "weight": "ultraLight" | "thin" | "light" | "regular" | "medium" | "semibold" | "bold" | "heavy" | "black" | <number>,
  "style": "normal" | "italic" | "oblique",
  "variant": "normal" | "smallCaps",
  "letterSpacing": <number>,
  "lineHeight": <number> | <string>
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `family` | string or array | Platform default | Font family name(s) |
| `size` | number | Platform default | Font size in points |
| `weight` | string or number | "regular" | Font weight |
| `style` | string | "normal" | Font style |
| `variant` | string | "normal" | Font variant |
| `letterSpacing` | number | 0 | Space between characters |
| `lineHeight` | number or string | Platform default | Line height (multiplier or exact) |

### 7.3 Text Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `lineLimit` | number or null | null | Maximum number of lines (null = unlimited) |
| `textAlignment` | string | "leading" | Text alignment within bounds |
| `color` | Color | Platform default | Text color |
| `truncationMode` | string | "clip" | How to truncate overflowing text |
| `lineBreakMode` | string | "wordWrap" | How to break lines |

## 8. Event System

### 8.1 Event Types

Pathland defines the following core event types:

| Type | Description | Platforms |
|------|-------------|-----------|
| `tap` | Single tap/click | All |
| `doubleTap` | Double tap/click | All |
| `longPress` | Long press | Touch |
| `click` | Mouse click (with button info) | Desktop |
| `hover` | Mouse hover | Desktop |
| `focus` | Focus gained | All |
| `blur` | Focus lost | All |
| `keyDown` | Key pressed | All |
| `keyUp` | Key released | All |
| `scroll` | Scroll action | All |
| `swipe` | Swipe gesture | Touch |

Implementations MAY define additional event types.

### 8.2 Event Structure

All events share a common structure:

```json
{
  "type": <string>,
  "timestamp": <number>,
  "target": <string>,
  "path": [<string>],
  "data": { ... }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Event type |
| `timestamp` | number | Yes | Event timestamp (milliseconds since epoch) |
| `target` | string | Yes | ID of the component that triggered the event |
| `path` | array of string | Yes | Path from root to target component |
| `data` | object | Yes | Event-specific data |

### 8.3 Event-Specific Data

#### 8.3.1 Tap Event

```json
{
  "type": "tap",
  "data": {
    "location": <Point>,
    "tapCount": <number>
  }
}
```

#### 8.3.2 Click Event

```json
{
  "type": "click",
  "data": {
    "location": <Point>,
    "button": "left" | "right" | "middle" | "back" | "forward",
    "clickCount": <number>,
    "modifiers": <EventModifiers>
  }
}
```

#### 8.3.3 Hover Event

```json
{
  "type": "hover",
  "data": {
    "isHovering": <boolean>,
    "location": <Point>
  }
}
```

#### 8.3.4 Focus/Blur Events

```json
{
  "type": "focus" | "blur",
  "data": {
    "isFocused": <boolean>
  }
}
```

#### 8.3.5 Keyboard Events

```json
{
  "type": "keyDown" | "keyUp",
  "data": {
    "key": <string>,
    "code": <string>,
    "modifiers": <EventModifiers>,
    "repeat": <boolean>
  }
}
```

#### 8.3.6 Scroll Event

```json
{
  "type": "scroll",
  "data": {
    "delta": <Point>,
    "contentOffset": <Point>,
    "contentSize": <Size>,
    "viewportSize": <Size>
  }
}
```

#### 8.3.7 Swipe Event

```json
{
  "type": "swipe",
  "data": {
    "direction": "left" | "right" | "up" | "down",
    "velocity": <number>,
    "distance": <number>
  }
}
```

#### 8.3.8 Event Modifiers

```json
{
  "shift": <boolean>,
  "control": <boolean>,
  "alt": <boolean>,
  "meta": <boolean>
}
```

### 8.4 Event Handlers

Event handlers are specified in the component's `events` object:

```json
{
  "events": {
    "onTap": <EventHandler>,
    "onClick": <EventHandler>,
    "onDoubleTap": <EventHandler>,
    "onLongPress": <EventHandler>,
    "onHover": <EventHandler>,
    "onFocus": <EventHandler>,
    "onBlur": <EventHandler>,
    "onKeyDown": <EventHandler>,
    "onKeyUp": <EventHandler>,
    "onScroll": <EventHandler>,
    "onSwipe": <EventHandler>
  }
}
```

An `EventHandler` is a reference to a function that will be called when the event occurs. The exact representation of an event handler is implementation-defined, as it depends on the host language's function representation.

### 8.5 Event Propagation

Events propagate according to the following rules:

1. **Capture Phase**: Event travels from root to target (optional, implementation-defined)
2. **Target Phase**: Event reaches the target component
3. **Bubble Phase**: Event travels from target back to root

Event handlers can:

- **Stop propagation**: Prevent further handlers from being called
- **Stop immediate propagation**: Prevent other handlers on the same component from being called
- **Prevent default**: Prevent the default action associated with the event

## 9. State Management

### 9.1 Signals

Pathland uses **signals** for reactive state management. A signal:

- Holds a value that can change over time
- Notifies dependents when its value changes
- Can be read by components
- Can be written to trigger updates

Signals are identified by a unique ID and MAY have a name for debugging.

### 9.2 Signal Types

| Type | Description |
|------|-------------|
| `state` | Mutable signal that can be set directly |
| `computed` | Derived signal whose value is computed from other signals |

### 9.3 Signal Structure

```json
{
  "id": <string>,
  "name": <string>,
  "value": <any>,
  "version": <number>,
  "computed": <boolean>,
  "dependencies": [<string>]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique signal identifier |
| `name` | string | No | Human-readable name |
| `value` | any | Yes | Current signal value |
| `version` | number | Yes | Version counter for change detection |
| `computed` | boolean | Yes | Whether this is a computed signal |
| `dependencies` | array of string | No | IDs of signals this signal depends on |

### 9.4 State Updates

When a signal's value changes:

1. The signal's `version` is incremented
2. All dependents are notified
3. Affected components are re-rendered

## 10. Renderer Interface

### 10.1 Renderer Responsibilities

A Pathland renderer MUST:

1. Accept **command batches** as input
2. Execute commands as a **pure function** to produce rendered output
3. Handle events from the platform and dispatch them to the application via component IDs
4. Clean up resources when done

**Critical Constraint**: A renderer MUST NOT maintain any application state. The renderer is a stateless executor of commands.

### 10.2 Statelessness Principle

> **A Pathland renderer is a PURE FUNCTION: same commands → same output**

The renderer:
- ✅ Takes command batches as input
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

### 10.4 Renderer Capabilities

A renderer SHOULD advertise its capabilities:

```json
{
  "platform": <string>,
  "supportsInteractivity": <boolean>,
  "supportsAnimation": <boolean>,
  "supportsAccessibility": <boolean>,
  "customCapabilities": [<string>]
}
```

### 10.5 Command Execution Process

The command execution process follows this stateless model:

1. **Application State Change**: Application updates signal values
2. **Command Generation**: Application generates minimal command list based on changes
3. **Command Transmission**: Application sends command batch to renderer
4. **Command Execution**: Renderer executes each command in order
5. **Renderer Output**: Renderer updates rendered output and ID→Element Map
6. **Event Dispatch**: Platform events are mapped to component IDs and sent to application
7. **Application Handling**: Application receives event with component ID, updates state
8. **Repeat**: Back to step 1

**Key Insight**: The renderer has no memory between command batches. Each batch is executed independently.

### 10.6 Command Efficiency

**Advantages of Command-Based Protocol:**

- **Minimal Transmission**: Only actual changes are sent, not the entire tree
- **Efficient Updates**: Commands describe exactly what changed
- **Network-Friendly**: Small payloads, ideal for remote rendering
- **Stateless**: Renderer doesn't need to maintain or understand tree structure
- **Flexible**: Commands can be batched, prioritized, or reordered by the application

**Example Efficiency Comparison:**
```
// Tree-based: Send entire tree (even if only one value changed)
Tree: { id: "app", children: [{ id: "counter", content: "1" }, ...] }

// Command-based: Send only what changed
Command: { type: "setContent", target: "counter", data: { content: "1" } }
```

### 10.4 Render Output

The render output is platform-specific and not defined by this protocol. Renderers MAY produce:

- DOM nodes (for web)
- Native views (for mobile)
- Graphics commands (for embedded)
- Any other platform-specific output

## 11. Protocol Extensions

### 11.1 Custom Components

Implementations MAY define custom component types. Custom components:

- MUST have a unique type name
- SHOULD document their properties and behavior
- MAY have custom modifiers
- MAY have custom event types

### 11.2 Custom Modifiers

Implementations MAY define custom modifiers for existing components. Custom modifiers:

- MUST be namespaced to avoid conflicts
- SHOULD document their behavior
- MAY be ignored by renderers that don't support them

### 11.3 Custom Events

Implementations MAY define custom event types. Custom events:

- MUST have a unique type name
- SHOULD follow the event structure defined in this specification
- MAY be ignored by renderers that don't support them

## 12. Serialization

### 12.1 JSON Serialization

The protocol can be serialized to JSON for transmission or storage. The JSON representation:

- MUST conform to the structure defined in this specification
- MUST use the type names and values defined in this specification
- MAY include additional fields for implementation-specific purposes

### 12.2 Binary Serialization

Implementations MAY define a binary serialization format for efficiency. Binary serialization:

- SHOULD be more compact than JSON
- SHOULD be faster to parse and generate
- MAY be platform-specific

## 13. Error Handling

### 13.1 Invalid Component Trees

Renderers SHOULD handle invalid component trees gracefully:

- Missing required fields: Use defaults or error
- Invalid values: Clamp, ignore, or error
- Circular references: Detect and error
- Unsupported components: Ignore or error

### 13.2 Rendering Errors

Renderers SHOULD handle rendering errors gracefully:

- Log errors for debugging
- Continue rendering other components
- Provide fallback rendering where possible

## 14. Security Considerations

### 14.1 Input Validation

Renderers SHOULD validate all inputs:

- Component tree structure
- Event data
- State updates
- Custom component definitions

### 14.2 Resource Limits

Renderers SHOULD enforce resource limits:

- Maximum component tree depth
- Maximum number of components
- Maximum state size
- Maximum event rate

## 15. Compliance

### 15.1 Conformance Testing

A conforming implementation MUST pass all conformance tests defined by the Pathland working group.

### 15.2 Versioning

This protocol uses semantic versioning (Major.Minor.Patch):

- **Major**: Breaking changes
- **Minor**: Backward-compatible new features
- **Patch**: Backward-compatible bug fixes

### 15.3 Feature Detection

Implementations SHOULD provide a way to detect supported features at runtime.

## Appendix A: Example Component Tree

```json
{
  "type": "vstack",
  "modifiers": {
    "gap": 16,
    "alignment": "center",
    "padding": {"all": 20},
    "background": {
      "color": "#F5F5F5"
    }
  },
  "children": [
    {
      "type": "text",
      "content": "Hello, Pathland!",
      "modifiers": {
        "font": {
          "family": "Arial",
          "size": 24,
          "weight": "bold"
        },
        "color": "#333333",
        "textAlignment": "center"
      }
    },
    {
      "type": "hstack",
      "modifiers": {
        "gap": 8,
        "justification": "center"
      },
      "children": [
        {
          "type": "text",
          "content": "Tap me",
          "modifiers": {
            "font": {"size": 16},
            "padding": {"horizontal": 16, "vertical": 8},
            "background": {"color": "#007AFF"},
            "border": {"radius": 8}
          },
          "events": {
            "onTap": "handleTap"
          }
        },
        {
          "type": "text",
          "content": "Or me",
          "modifiers": {
            "font": {"size": 16},
            "padding": {"horizontal": 16, "vertical": 8},
            "background": {"color": "#34C759"},
            "border": {"radius": 8}
          },
          "events": {
            "onTap": "handleTap"
          }
        }
      ]
    }
  ]
}
```

## Appendix B: Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0-alpha | 2024 | Initial draft |
