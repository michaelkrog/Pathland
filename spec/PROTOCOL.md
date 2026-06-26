# Pathland Protocol Specification

**Version:** 2.0.0-alpha  
**Status:** Draft  
**Last Updated:** June 26, 2026

> **IMPORTANT**: This document provides a **conceptual overview** of Pathland's architecture and design principles. For **all protocol implementation details** including opcodes, component types, property IDs, value types, and binary encoding formats, see the **[BINARY_PROTOCOL.md](./BINARY_PROTOCOL.md)** specification, which is the **sole authoritative source**.

> **Note**: This document does NOT contain protocol implementation details. It focuses on the *why* and *what* of Pathland, not the *how*. For the *how*, always refer to BINARY_PROTOCOL.md.

---

## Abstract

Pathland is a cross-platform, cross-language UI protocol inspired by SwiftUI, designed to enable retained-mode UI development with multiple renderer backends. This document defines the protocol's **architecture and core concepts** independent of any specific runtime or programming language.

The Pathland protocol is built on a **command-based binary instruction model** that enables efficient, stateless rendering across diverse platforms.

---

## 1. Introduction

### 1.1 Purpose

This specification defines a standardized approach for describing user interfaces in a way that is:

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

1. Support the binary protocol format exactly as specified in BINARY_PROTOCOL.md
2. Produce predictable and consistent rendering results
3. Adhere to the stateless renderer principle

A conforming implementation MAY:

1. Add custom component types
2. Add custom opcodes (in the reserved ranges)
3. Add custom event types
4. Optimize rendering for specific platforms

---

## 2. Core Concepts

### 2.1 Architecture Overview

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
│           ▼                                                                 │
│  ┌─────────────────┐                                                   │
│  │   SIGNALS        │                                                   │
│  │   (State)        │                                                   │
│  └─────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────┘
```

**KEY POINTS:**
- State lives ONLY in the Application (Signals)
- Application generates COMMANDS as binary messages, not trees
- Renderer executes commands as a PURE FUNCTION
- Only actual changes are transmitted (efficient)
- Events flow: Platform → Renderer → Application (via Component IDs)
- Component IDs are the ONLY link between Renderer and Application
- Renderer maintains NO state between command batches

### 2.2 Stateless Command Execution

Pathland uses **stateless command execution**:

1. The application generates commands based on state changes
2. Commands are transmitted to the renderer as binary messages
3. The renderer executes each command in order
4. The renderer does NOT maintain the component tree between command batches
5. The renderer does NOT cache or remember any state

**Key Insight**: The renderer is a pure function that transforms a stream of commands into rendered output. It has no memory of previous commands or the current UI state.

### 2.3 Data Flow

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

## 3. Renderer Interface

### 3.1 Renderer Responsibilities

A Pathland renderer MUST:

1. Accept **binary command batches** as input (via BINARY_PROTOCOL.md format)
2. Execute commands as a **pure function** to produce rendered output
3. Handle events from the platform and dispatch them to the application via component IDs
4. Clean up resources when done

**Critical Constraint**: A renderer MUST NOT maintain any application state. The renderer is a stateless executor of commands.

### 3.2 Statelessness Principle

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

### 3.3 Command Execution Process

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

## 4. Design Token System

### 4.1 Overview

The Pathland protocol implements a **design token system** as the foundation of all theming and visual styling.

**Core Principle:** The protocol defines structure and semantic state only. Visual appearance is fully derived from design tokens in the renderer.

**Responsibilities:**
- **Application**: Defines structure, semantic state, and token overrides
- **Protocol**: Carries structure + semantic state + token overrides only
- **Renderer**: Owns design token definitions, resolves tokens into concrete visuals, defines interaction state behaviors

This system allows:
- New components to be introduced without protocol changes
- New token categories to be added without breaking changes
- Theme variations to be supported at renderer level
- Platform-specific conventions to be respected

For complete design token specifications, see **[BINARY_PROTOCOL.md - Design Token System](./BINARY_PROTOCOL.md#design-token-system)**.

### 4.2 Token Categories

Design tokens are organized into categories representing different visual primitives:

| Category | Description | Examples |
|----------|-------------|----------|
| Color Tokens | Color values | `color.primary`, `color.text.primary` |
| Typography Tokens | Font styling | `font.body`, `font.size.body` |
| Spacing Tokens | Spacing values | `space.1`, `space.md` |
| Shape Tokens | Border radius | `radius.small`, `radius.medium` |
| Elevation Tokens | Shadow/elevation | `elevation.low`, `elevation.high` |

---

## 5. Color System

### 5.1 Overview

The Pathland color system supports two kinds of colors:

1. **Semantic colors** (preferred) - Platform-agnostic color roles that adapt to the renderer's theme
2. **Literal sRGB colors** - Explicit color values in the sRGB color space

**Important**: All literal colors in the Pathland protocol MUST be interpreted as sRGB (IEC 61966-2-1) with D65 white point and standard sRGB transfer function.

### 5.2 Semantic Color Tokens

Semantic color tokens represent platform-agnostic color roles that adapt to the renderer's theme, accessibility settings, and platform conventions.

Examples:
- PRIMARY_TEXT - Primary text color (adapts to light/dark mode)
- BACKGROUND - Primary background color
- ACCENT - Accent color for interactive elements
- ERROR - Error state color

### 5.3 Literal sRGB Colors

Literal colors are encoded as packed RGBA (32-bit) in little-endian format with the bit layout: 0xAARRGGBB.

The protocol guarantees consistent **color definition** (sRGB), not identical physical appearance across all displays.

For complete color specifications, see **[BINARY_PROTOCOL.md - Color Value Type](./BINARY_PROTOCOL.md#color-value-type)**.

---

## 6. Protocol Extensions

### 6.1 Custom Components

Implementations MAY define custom component types using IDs in the reserved ranges:
- `0x0009-0x7FFF`: Future core components
- `0x8000-0xFFFF`: Custom/experimental components

Custom components:
- MUST have a unique type ID
- SHOULD document their properties and behavior
- MAY have custom properties
- MAY be ignored by renderers that don't support them

### 6.2 Custom Properties

Implementations MAY define custom properties for existing components. Custom properties:
- MUST use IDs in the reserved ranges (0x1011-0xFFFF for style properties)
- SHOULD document their behavior
- MAY be ignored by renderers that don't support them

---

## 7. Compliance

### 7.1 Conformance Testing

A conforming implementation MUST pass all conformance tests defined by the Pathland working group.

### 7.2 Versioning

This protocol uses semantic versioning (Major.Minor.Patch):
- **Major**: Breaking changes
- **Minor**: Backward-compatible new features
- **Patch**: Backward-compatible bug fixes

### 7.3 Feature Detection

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
| 2.0.0-alpha | June 26, 2026 | Restructured as purely conceptual document; removed all protocol implementation details |
| 1.0.0-alpha | 2024 | Initial draft |

---

**Note**: This document provides a **conceptual overview** of Pathland's architecture. The **[BINARY_PROTOCOL.md](./BINARY_PROTOCOL.md)** specification is the **sole authoritative source** for all protocol implementation details. All questions about opcodes, component types, property IDs, value types, and binary encoding formats must be answered by consulting BINARY_PROTOCOL.md.