# Pathland Protocol

> A cross-platform, cross-language UI protocol inspired by SwiftUI

## Overview

Pathland is a **protocol-first** UI framework designed to enable retained-mode UI development with multiple renderer backends. It's inspired by SwiftUI's declarative syntax and reactive state management, but designed to be **language-agnostic** and **platform-agnostic**.

## Core Principles

- **Protocol-first**: Standardized, open protocol for UI components, state, and events
- **Retained-mode**: UI defined as a tree of components with state and lifecycle
- **Renderer-agnostic**: Supports server-owned, SSR, prerendered, and client-rendered apps
- **Minimal runtime**: Lightweight with scoped state
- **SwiftUI-inspired**: Syntax and concepts aligned with SwiftUI design
- **🔥 Stateless Renderers**: **Renderers maintain NO state** - they are pure functions that transform component trees into rendered output. Component IDs are the ONLY information retained (for event routing)

## Documentation

### Protocol Specification

- [Main Protocol Document](./spec/PROTOCOL.md) - Core protocol overview and concepts
- [Component Specifications](./spec/components/COMPONENTS.md) - Detailed component definitions
- [Event System](./spec/events/EVENTS.md) - Complete event system specification
- [State Management](./spec/state/STATE.md) - Signal-based state management

### Examples

- [Counter Example](./examples/COUNTER_EXAMPLE.md) - Demonstrates HStack, VStack, Text with styling and events
- [Form Example](./examples/FORM_EXAMPLE.md) - Complete login form with validation

## Core Components

### Layout Components

| Component | Description | Key Modifiers |
|-----------|-------------|---------------|
| `hstack` | Horizontal stack container | gap, alignment, justification, padding, border, background |
| `vstack` | Vertical stack container | gap, alignment, justification, padding, border, background |

### Content Components

| Component | Description | Key Modifiers |
|-----------|-------------|---------------|
| `text` | Text display | font, lineLimit, textAlignment, color, padding, border, background |

## Layout Modifiers

### Stack Layout (HStack & VStack)

- **`gap`**: Space between children (Length)
- **`alignment`**: Cross-axis alignment (`"leading"`, `"center"`, `"trailing"`)
- **`justification`**: Main-axis distribution (`"leading"`, `"center"`, `"trailing"`, `"spaceBetween"`, `"spaceAround"`, `"spaceEvenly"`)

### Spacing

- **`padding`**: Inner padding (EdgeInsets or Length)

### Borders

- **`border`**: Border styling (BorderStyle)
  - `width`: Border thickness
  - `color`: Border color
  - `radius`: Corner radius (Length or CornerRadii)
  - `style`: Border style (`"solid"`, `"dotted"`, `"dashed"`, etc.)

### Background

- **`background`**: Background styling (BackgroundStyle)
  - `color`: Solid color
  - `gradient`: Gradient (LinearGradient or RadialGradient)
  - `image`: Background image
  - `opacity`: Opacity (0.0 to 1.0)

### Frame

- **`frame`**: Size constraints (FrameModifier)
  - `width`, `height`: Dimensions
  - `minWidth`, `maxWidth`, `minHeight`, `maxHeight`: Size constraints
  - `alignment`: Content alignment within frame

## Text Modifiers

### Font

- **`font`**: Font styling (FontStyle)
  - `family`: Font family name(s)
  - `size`: Font size in points
  - `weight`: Font weight (`"ultraLight"`, `"thin"`, `"light"`, `"regular"`, `"medium"`, `"semibold"`, `"bold"`, `"heavy"`, `"black"`, or numeric 100-900)
  - `style`: Font style (`"normal"`, `"italic"`, `"oblique"`)
  - `variant`: Font variant (`"normal"`, `"smallCaps"`)
  - `letterSpacing`: Space between characters
  - `lineHeight`: Line height (multiplier or exact)

### Text Layout

- **`lineLimit`**: Maximum number of lines (number or null for unlimited)
- **`textAlignment`**: Text alignment (`"leading"`, `"center"`, `"trailing"`)

### Text Appearance

- **`color`**: Text color
- **`truncationMode`**: How to truncate overflow (`"clip"`, `"head"`, `"tail"`, `"middle"`)
- **`lineBreakMode`**: How to break lines (`"wordWrap"`, `"characterWrap"`, etc.)

## Event System

### Core Event Types

| Event | Description | Handler |
|-------|-------------|---------|
| `tap` | Single tap/click | `onTap` |
| `doubleTap` | Double tap/click | `onDoubleTap` |
| `longPress` | Long press | `onLongPress` |
| `click` | Mouse click with button info | `onClick` |
| `hover` | Mouse hover | `onHover` |
| `focus` | Focus gained | `onFocus` |
| `blur` | Focus lost | `onBlur` |
| `keyDown` | Key pressed | `onKeyDown` |
| `keyUp` | Key released | `onKeyUp` |
| `scroll` | Scroll action | `onScroll` |
| `swipe` | Swipe gesture | `onSwipe` |

### Event Structure

```json
{
  "type": "tap",
  "timestamp": 1234567890,
  "target": "button-id",
  "path": ["root", "container", "button-id"],
  "data": {
    "location": {"x": 50, "y": 25},
    "tapCount": 1
  }
}
```

### Event Propagation

1. **Capture Phase** (optional): Root → Target
2. **Target Phase**: Target component handlers
3. **Bubble Phase**: Target → Root

Handlers can:
- `stopPropagation()`: Stop further propagation
- `stopImmediatePropagation()`: Stop other handlers on same component
- `preventDefault()`: Prevent default action

## State Management

### Signals

Pathland uses **signals** for reactive state management:

```json
{
  "id": "counter",
  "name": "Counter",
  "value": 0,
  "version": 1,
  "computed": false,
  "dependencies": [],
  "dependents": ["counter-display"]
}
```

### Signal Types

- **State Signal**: Mutable value that can be set directly
- **Computed Signal**: Derived value that updates automatically when dependencies change

### Signal Operations

- `get()`: Read current value
- `set(newValue)`: Set new value and trigger updates
- `update(fn)`: Update value using a function

## Protocol Features

### Language-Agnostic

The protocol is defined in a **language-independent** way using JSON-like structures. It can be implemented in:
- TypeScript/JavaScript
- Swift
- Kotlin
- Python
- C++
- Rust
- Any other language

### Platform-Agnostic

Pathland can target:
- **Web** (HTML/CSS/JS)
- **Mobile** (iOS, Android)
- **Desktop** (macOS, Windows, Linux)
- **Embedded** (LVGL, custom graphics)

### Renderer-Agnostic

Any compliant renderer can implement the protocol:
- DOM-based renderers
- Native view renderers
- Graphics library renderers
- Custom renderers

## Data Types

### Primitive Types

- `string`: UTF-8 text
- `number`: 64-bit floating point
- `boolean`: true or false
- `null`: Absence of value

### Composite Types

- **Length**: Absolute (number) or relative (string like `"50%"` or `"auto"`)
- **Color**: Hex (`"#RRGGBB"`), RGB (`"rgb(R,G,B)"`), or named colors
- **Point**: `{x: number, y: number}`
- **Size**: `{width: Length, height: Length}`
- **Rect**: `{origin: Point, size: Size}`
- **EdgeInsets**: `{top: Length, right: Length, bottom: Length, left: Length}`

## Example Component Tree

```json
{
  "type": "vstack",
  "modifiers": {
    "gap": 16,
    "alignment": "center",
    "padding": {"all": 20}
  },
  "children": [
    {
      "type": "text",
      "content": "Hello, Pathland!",
      "modifiers": {
        "font": {"family": "Arial", "size": 24, "weight": "bold"},
        "color": "#333333"
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
            "padding": {"horizontal": 16, "vertical": 8},
            "background": {"color": "#007AFF"},
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

## Getting Started

### For Protocol Implementers

1. Read the [Protocol Specification](./spec/PROTOCOL.md)
2. Study the [Component Specifications](./spec/components/COMPONENTS.md)
3. Review the [Event System](./spec/events/EVENTS.md)
4. Understand the [State Management](./spec/state/STATE.md)
5. Implement a renderer for your target platform

### For Application Developers

1. Use a Pathland-compatible library for your language
2. Build component trees using HStack, VStack, and Text
3. Add modifiers for styling and layout
4. Register event handlers
5. Manage state with signals

## Versioning

Pathland follows **Semantic Versioning** (Major.Minor.Patch):
- **Major**: Breaking changes
- **Minor**: Backward-compatible new features
- **Patch**: Backward-compatible bug fixes

Current version: **1.0.0-alpha**

## Contributing

Contributions are welcome! Please see the [LICENSE](LICENSE) file for licensing information.

## License

Pathland is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.
