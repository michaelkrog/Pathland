# Pathland TypeScript Library Specification

This document defines the structure, responsibilities, and design principles for the Pathland TypeScript libraries.

## Overview

The Pathland TypeScript implementation is organized as a **monorepo** with multiple independent packages. Each package has a single, well-defined responsibility and depends only on what it needs.

**Key Principle**: The library as a whole covers protocol, rendering, and transportation concerns, but these are **strictly divided into separate packages** with clear boundaries.

## Monorepo Structure

```
lib/typescript/                    # Monorepo root
├── package.json                   # Workspace configuration
└── packages/
    ├── protocol/                 # Core protocol (no dependencies)
    ├── transport/                # Message transportation
    ├── view/                    # Reactive view framework
    ├── renderer-dom/            # DOM-based rendering
    ├── renderer-html/           # HTML string rendering
    └── renderer-jsdom/          # JSDOM-based rendering for Node.js
```

## Packages

### 1. `@pathland/protocol` - Core Protocol

**Responsibility**: Binary encoding and decoding of Pathland messages.

**Scope**: Pure data transformation - commands to bytes and bytes to commands.

**Provides**:
- All protocol constants (opcodes, component types, property IDs, etc.)
- Type definitions (Command, PropertyValue, etc.)
- `BinaryWriter` and `BinaryReader` for low-level binary operations
- `encodeMessage(commands)` → `Uint8Array`
- `decodeMessage(buffer)` → `{version, commands}`

**Does NOT provide**:
- Any rendering logic
- Any transportation logic
- Any application state management
- Any platform-specific code

**Dependencies**: None

### 2. `@pathland/transport` - Message Transportation

**Responsibility**: Sending and receiving binary messages over various transports.

**Scope**: Transportation abstractions for different communication channels.

**Provides**:
- `Transport` interface (common API for all transports)
- `MemoryTransport` - In-memory for testing
- `PostMessageTransport` - Browser window/iframe communication
- `WebSocketTransport` - WebSocket server communication
- `serializeMessage()` / `deserializeMessage()` - ArrayBuffer serialization
- `createTransferable()` - Zero-copy postMessage transfers
- Buffer utilities (concat, split, base64)

**Depends on**: `@pathland/protocol`

### 3. `@pathland/view` - Reactive View Framework

**Responsibility**: Provide a component-based, Angular-like API for building UI that compiles to Pathland's binary protocol with fine-grained reactivity.

**Scope**: Application-level command generation with reactive state management. Core components (VStack, HStack, Text) are provided as factory functions, while custom views are implemented as classes.

**Provides**:
- `ViewNode` class - Immutable node in the virtual UI tree with chainable API
- `Signal` class - Reactive values that directly generate SET_PROPERTY commands
- Core component factories: `VStack()`, `HStack()`, `Text()`
- Chainable styling methods: `.padding()`, `.background()`, `.color()`, `.fontSize()`, etc.
- Chainable gesture methods: `.tapGesture()`, `.longPressGesture()`
- `View` base class for custom components with `body()` method pattern
- `initialRender()` function for compiling ViewNode trees to Pathland commands
- `commandQueue` for batching commands before transport

**Component Composition Pattern**:
- Core components (VStack, HStack, Text) remain as **factory functions** for simplicity
- Custom components are implemented as **classes** that create and return ViewNodes
- This allows clean composition: custom classes use functional core components internally

**Example**:
```typescript
// Custom Card component as a class
class Card {
  private expanded = new Signal(false);
  
  createView(): ViewNode {
    return VStack(
      HStack(
        Text('Card Title'),
        Text(this.expanded.map(e => e ? '[-]' : '[+]'))
          .tapGesture(() => this.expanded.set(!this.expanded.get()))
      ),
      this.expanded.get() ? Text('Expanded content') : undefined
    ).padding(8).background('surface');
  }
}

// App uses custom components
class App {
  createView(): ViewNode {
    return VStack(
      new Card().createView(),
      Text('Other content')
    );
  }
}
```

**Does NOT provide**:
- Any rendering logic (see renderer packages)
- Any transportation logic (see transport package)
- Virtual DOM or tree diffing algorithms
- Platform-specific code

**Depends on**: `@pathland/protocol`, `@pathland/transport`

### 4. `@pathland/renderer-dom` - DOM Renderer

**Responsibility**: Execute Pathland commands to create and manage live DOM elements.

**Scope**: Browser-based rendering only. Maintains minimal state for event routing.

**Provides**:
- `DOMRenderer` class
- Creates appropriate DOM elements for each component type
- Applies properties as CSS styles and attributes
- Handles CREATE_NODE, DELETE_NODE, INSERT_CHILD, REMOVE_CHILD, SET_PROPERTY
- Maintains nodeId → DOM element mapping for event routing
- Supports HSTACK, VSTACK, TEXT, BUTTON, IMAGE, SPACER, SCROLLVIEW, etc.

**Does NOT provide**:
- HTML string generation (see renderer-html)
- Non-browser rendering (e.g., server-side, canvas)
- Application logic
- Event handling implementation

**Depends on**: `@pathland/protocol`

**Statelessness**: Only maintains `Map<number, HTMLElement>` for event routing. All other state is derived from commands.

### 5. `@pathland/renderer-html` - HTML String Renderer

**Responsibility**: Execute Pathland commands and output HTML markup strings.

**Scope**: Server-side rendering (SSR) and HTML string generation.

**Provides**:
- `HTMLRenderer` class
- Executes commands and builds HTML tree in memory
- `render()` → HTML string output
- `renderNode(nodeId)` → render specific node
- `renderChildren(nodeId)` → render only children
- Supports all the same component types as renderer-dom
- Outputs data attributes for Pathland metadata

**Does NOT provide**:
- Live DOM manipulation (see renderer-dom)
- Browser-specific code
- Transportation

**Depends on**: `@pathland/protocol`

**Statelessness**: Builds HTML from commands, no persistent state beyond the current command batch.

### 6. `@pathland/renderer-jsdom` - JSDOM Renderer

**Responsibility**: Execute Pathland commands to create and manage a JSDOM-based DOM tree in Node.js.

**Scope**: Node.js environments requiring DOM APIs (testing, SSR, snapshots).

**Provides**:
- `JSDOMRenderer` class
- Uses jsdom to provide full DOM APIs in Node.js
- Creates appropriate DOM elements for each component type
- Applies properties as CSS styles and attributes
- Maintains nodeId → JSDOM element mapping for event routing
- `getHTML()` → full document HTML string
- `getBodyHTML()` → body content HTML string
- `getJSDOM()` → access to JSDOM instance
- `getWindow()` / `getDocument()` → access to DOM APIs
- DOM query methods (`querySelector`, `querySelectorAll`)

**Does NOT provide**:
- Simple HTML string generation (see renderer-html for lighter alternative)
- Browser-specific rendering (see renderer-dom)
- Transportation
- Application logic

**Depends on**: `@pathland/protocol`, `jsdom`

**Statelessness**: Only maintains `Map<number, JSDOMRenderElement>` for event routing. All other state is derived from commands.

## Package Boundaries

| From \ To | protocol | transport | view | renderer-dom | renderer-html | renderer-jsdom |
|-----------|----------|-----------|------|--------------|---------------|----------------|
| protocol | - | ✓ | ✓ | ✓ | ✓ | ✓ |
| transport | - | - | ✓ | - | - | - |
| view | - | - | - | ✓ | ✓ | ✓ |
| renderer-dom | - | - | - | - | - | - |
| renderer-html | - | - | - | - | - | - |
| renderer-jsdom | - | - | - | - | - | - |

**Dependency Rule**: Packages can only depend on packages to their left in the table above.

This ensures:
- `protocol` has no dependencies
- `transport` only depends on `protocol`
- `view` depends on `protocol` and `transport`
- `renderer-dom` only depends on `protocol`
- `renderer-html` only depends on `protocol`
- `renderer-jsdom` depends on `protocol` and `jsdom` (external)

## Usage Patterns

### Standalone Protocol
```typescript
import { encodeMessage, decodeMessage, ComponentType } from '@pathland/protocol';

const commands = [{ opcode: 'CREATE_NODE', nodeId: 1, componentType: ComponentType.TEXT, properties: new Map() }];
const binary = encodeMessage(commands);
const { version, commands: decoded } = decodeMessage(binary);
```

### Protocol + Transport
```typescript
import { encodeMessage } from '@pathland/protocol';
import { WebSocketTransport } from '@pathland/transport';

const transport = new WebSocketTransport('ws://localhost:8080');
transport.onMessage(({ commands }) => {
  // Handle incoming commands
});

// Send commands
transport.send(commands);
```

### Protocol + Renderer
```typescript
import { decodeMessage } from '@pathland/protocol';
import { DOMRenderer } from '@pathland/renderer-dom';

const renderer = new DOMRenderer(document.getElementById('app'));

// Receive binary message
const message = decodeMessage(binaryBuffer);
renderer.executeCommands(message.commands);
```

### Full Stack
```typescript
import { WebSocketTransport } from '@pathland/transport';
import { DOMRenderer } from '@pathland/renderer-dom';

const transport = new WebSocketTransport('ws://server');
const renderer = new DOMRenderer();

transport.onMessage(({ commands }) => {
  renderer.executeCommands(commands);
});
```

## Adding New Packages

New packages should follow these rules:

1. **Single Responsibility**: Each package does one thing well
2. **Minimal Dependencies**: Only depend on packages you absolutely need
3. **Clear Boundaries**: No circular dependencies
4. **Protocol First**: All packages that work with Pathland data depend on `@pathland/protocol`

Example future packages:
- `@pathland/renderer-canvas` - Canvas 2D rendering
- `@pathland/renderer-svg` - SVG rendering
- `@pathland/renderer-terminal` - Terminal/ANSI rendering
- `@pathland/app` - Application utilities for command generation
- `@pathland/state` - State management helpers

## Build and Publish

The monorepo uses npm workspaces:

```bash
# Build all packages
npm run build

# Publish (from each package directory)
cd packages/protocol && npm publish
cd packages/transport && npm publish
cd packages/view && npm publish
cd packages/renderer-dom && npm publish
cd packages/renderer-html && npm publish
cd packages/renderer-jsdom && npm publish
```

## Versioning

Each package is versioned independently following semantic versioning:
- MAJOR: Breaking changes to public API
- MINOR: Backward-compatible new features
- PATCH: Backward-compatible bug fixes

**Protocol version** (in message header) is separate from package versions.

## Package Contents

### protocol/
```
src/
├── index.ts              # Public exports
└── protocol/
    ├── constants.ts     # All protocol constants
    ├── types.ts         # TypeScript type definitions
    └── binary.ts        # Binary encoding/decoding
```

### transport/
```
src/
└── index.ts              # All transport exports
```

### view/
```
src/
├── index.ts              # Public exports
├── signal.ts             # Signal reactivity class
├── view-node.ts          # ViewNode class with chainable API
├── components.ts         # Core component factories (VStack, HStack, Text)
├── renderer.ts           # Initial render function
└── utils.ts              # Shared utilities (propertyNameToId, compilePropertyValue)
```

### renderer-dom/
```
src/
└── index.ts              # DOMRenderer class
```

### renderer-html/
```
src/
└── index.ts              # HTMLRenderer class
```

### renderer-jsdom/
```
src/
└── index.ts              # JSDOMRenderer class
```
