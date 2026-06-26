# Pathland Protocol

> A cross-platform, cross-language UI protocol inspired by SwiftUI

## Overview

Pathland is a **protocol-first** UI framework designed to enable retained-mode UI development with multiple renderer backends. It's inspired by SwiftUI's declarative syntax, but designed to be **language-agnostic** and **platform-agnostic**.

## Core Principles

- **Protocol-first**: Standardized, open protocol for UI components and events
- **Command-based**: UI updates transmitted as **commands** (CREATE_NODE, DELETE_NODE, INSERT_CHILD, REMOVE_CHILD, SET_PROPERTY) rather than complete trees
- **Binary Protocol**: Custom binary instruction protocol (bytecode/ABI) optimized for frequent tree mutations
- **Stateless Renderers**: **Renderers maintain NO state** - they are pure functions that execute commands. Component IDs are the ONLY information retained (for event routing)
- **Renderer-agnostic**: Supports server-owned, SSR, prerendered, and client-rendered apps simultaneously
- **Minimal runtime**: Lightweight
- **SwiftUI-inspired**: Syntax and concepts aligned with SwiftUI design

## Documentation

### Protocol Specification

- [Binary Protocol](./spec/BINARY_PROTOCOL.md) - **Primary specification** - Custom binary instruction protocol with opcodes, component types, property IDs, and encoding rules
- [Protocol Overview](./spec/PROTOCOL.md) - Core protocol concepts and architecture
- [Component Specifications](./spec/components/COMPONENTS.md) - Detailed component definitions
- [Event System](./spec/events/EVENTS.md) - Complete event system specification

### Proof of Concept (POC)

A working implementation is available in the [`/poc/`](./poc/) directory:
- **HTML Renderer** - Full implementation of the binary protocol renderer for web browsers
- **Demo Page** - Interactive demo with 5 examples:
  1. Simple VStack with Text (semantic colors)
  2. HStack with Spacer
  3. Nested Stacks
  4. Styled components (background, padding, opacity)
  5. **Live Clock** - Real-time clock updating every second, with bold font at :00, :10, :20, :30, :40, :50
- **Performance Timing** - Each demo logs encoding, parsing, and rendering times to console
- **Protocol Inspection** - View the binary protocol commands and hex dump for each demo

To run the POC:
```bash
cd poc
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

### Examples

- [Counter Example](./examples/COUNTER_EXAMPLE.md) - Demonstrates HStack, VStack, Text with styling and events
- [Form Example](./examples/FORM_EXAMPLE.md) - Complete login form with validation

## Implemented Components (POC)

The POC currently implements the following components with full binary protocol support:

### Layout Components

| Component | Type ID | Description |
|-----------|---------|-------------|
| `HSTACK` | `0x0001` | Horizontal stack container |
| `VSTACK` | `0x0002` | Vertical stack container |
| `SPACER` | `0x0008` | Flexible spacer (fills available space) |

### Content Components

| Component | Type ID | Description |
|-----------|---------|-------------|
| `TEXT` | `0x0003` | Text display with styling |
| `BUTTON` | `0x0004` | Interactive button |

### Supported Properties

**Stack Properties (HSTACK/VSTACK):**
- `SPACING` (0x0001) - Gap between children
- `ALIGNMENT` (0x0002) - Cross-axis alignment
- `JUSTIFICATION` (0x0003) - Main-axis distribution
- `PADDING` (0x0004) - Inner padding

**Text Properties:**
- `TEXT` (0x000A) - Text content
- `LINE_LIMIT` (0x000B) - Maximum lines
- `TEXT_ALIGNMENT` (0x000C) - Text alignment

**Style Properties:**
- `COLOR` (0x100A) - Text color (semantic or literal sRGB)
- `FONT_SIZE` (0x1007) - Font size in pixels
- `FONT_WEIGHT` (0x1008) - Font weight enum
- `BACKGROUND_COLOR` (0x1001) - Background color
- `OPACITY` (0x100D) - Opacity value
- `VISIBLE` (0x100E) - Visibility toggle
- `WIDTH` (0x100B) / `HEIGHT` (0x100C) - Dimensions

**Color System:**
- Semantic color tokens (PRIMARY_TEXT, SECONDARY_TEXT, BACKGROUND, etc.)
- Literal sRGB colors as packed RGBA (0xAARRGGBB)

For full component specifications, see [COMPONENTS.md](./spec/components/COMPONENTS.md).

## Architecture

### Command-Based Protocol

The protocol transmits **tree mutations** as a stream of commands:
- `CREATE_NODE` (0x01) - Create a new component with properties
- `DELETE_NODE` (0x02) - Remove a component
- `INSERT_CHILD` (0x03) - Add child to parent at index
- `REMOVE_CHILD` (0x04) - Remove child from parent
- `SET_PROPERTY` (0x05) - Update a property value
- `SET_DESIGN_TOKEN` (0x06) - Override design token

### Message Format

Each message contains:
- Header: version (u16) + instruction count (u32)
- Body: Sequence of binary-encoded commands

### Binary Encoding

- **Opcodes**: u8 (1 byte)
- **Node IDs**: u32 (4 bytes)
- **Component Types**: u16 (2 bytes)
- **Property IDs**: u16 (2 bytes)
- **Value Types**: u8 (1 byte) with typed payloads
- **Strings**: u32 length prefix + UTF-8 bytes
- **Colors**: Tagged union (semantic token or packed RGBA u32)

For complete encoding details, see [BINARY_PROTOCOL.md](./spec/BINARY_PROTOCOL.md).

## Event System

The protocol supports a comprehensive event system with binary encoding. Event types include:
- TAP, DOUBLE_TAP, LONG_PRESS
- CLICK, HOVER, FOCUS, BLUR
- KEY_DOWN, KEY_UP
- SCROLL, SWIPE
- ON_APPEAR, ON_DISAPPEAR, ON_CHANGE

For complete event specifications, see [EVENTS.md](./spec/events/EVENTS.md).

**Note**: Event handling in the POC HTML renderer is not yet implemented - this is planned for a future phase.

## State Management

The application generates commands to mutate the UI tree. The renderer is stateless and only executes commands.

**Note**: The POC currently uses a simple imperative application model for demonstration purposes.

## Protocol Features

### Design Tokens

Pathland uses a **design token system** for theming:
- Renderer owns the default theme and visual appearance
- Application can override token values globally
- Interaction states (hover, pressed, focus) are **renderer responsibilities**
- Semantic colors resolve differently based on platform/theme

### Color System

- **Semantic tokens**: PRIMARY_TEXT, SECONDARY_TEXT, BACKGROUND, SURFACE, ACCENT, ERROR, etc.
- **Literal colors**: Packed RGBA u32 values in sRGB color space (0xAARRGGBB)
- All literal colors are explicitly defined as **sRGB** with D65 white point

### Renderer Responsibilities

- Owns design tokens and their default values
- Resolves semantic tokens to concrete visuals
- Defines interaction state behavior (hover, pressed, focus)
- Applies theme logic
- Converts sRGB to native display space when supported

## Key Differentiators

### vs. React
- **No hooks** - Uses signals instead of useState, useEffect, useMemo
- **No virtual DOM** - Command-based protocol, not diffing
- **No JSX transformations** - Direct component creation
- **Stateless renderers** - Pure functions, no internal state

### vs. Flutter
- **Protocol-first** - Not tied to a specific rendering engine
- **Multiple backends** - Can target DOM, native views, graphics libraries
- **No widget tree** - Retained tree with explicit mutations

### vs. Traditional DOM APIs
- **Not imperative** - Declarative component definitions
- **Not DOM-specific** - Renderer-agnostic protocol
- **Minimal overhead** - Only transmits actual changes

## Getting Started

### For Protocol Implementers

1. Read the [Binary Protocol](./spec/BINARY_PROTOCOL.md)
2. Study the [Component Specifications](./spec/components/COMPONENTS.md)
3. Review the [Event System](./spec/events/EVENTS.md)
4. Implement a renderer for your target platform

### For Application Developers

1. Use a Pathland-compatible library for your language
2. Build component trees using HStack, VStack, and Text
3. Add modifiers for styling and layout
4. Register event handlers

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
