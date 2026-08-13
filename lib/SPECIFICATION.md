# Pathland TypeScript Library Specification

This document defines the structure, responsibilities, and design principles for the Pathland TypeScript libraries.

## Overview

The Pathland TypeScript implementation is organized as a **monorepo** with multiple independent packages. Each package has a single, well-defined responsibility and depends only on what it needs.

**Key Principle**: The library as a whole covers protocol, rendering, and transportation concerns, but these are **strictly divided into separate packages** with clear boundaries.

## Core Requirements

### Bundler Independence
**The library MUST NOT depend on any specific bundler (Vite, Webpack, Rollup, etc.).**

- All packages must use standard JavaScript/TypeScript features only
- No bundler-specific globals (e.g., `__DEV__`, `import.meta.env`) 
- No bundler-specific import syntax or conventions
- No bundler-specific file naming conventions
- Bundler configuration is the **application's responsibility**, not the library's

**Rationale**: Pathland should work in any environment - browser with any bundler, Node.js, or even without a bundler. Bundler-specific concerns belong in the application or in separate adapter packages.

## Monorepo Structure

```
lib/typescript/                    # Monorepo root
├── package.json                   # Workspace configuration
└── packages/
    ├── protocol/                 # Core protocol (no dependencies)
    ├── renderer/                 # Renderer interface + shared interaction
    ├── transport/                # Message transportation
    ├── view/                    # Reactive view framework
    ├── platform-browser/        # Browser platform bootstrap
    ├── renderer-dom/            # DOM rendering (browser + JSDOM)
    └── renderer-html/           # HTML string rendering
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
  
  body(): ViewNode {
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
  body(): ViewNode {
    return VStack(
      Card.make(),
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

### 4. `@pathland/platform-browser` - Browser Platform Bootstrap

**Responsibility**: Provide a simple, Angular-like bootstrap function for browser-based Pathland applications.

**Scope**: Platform-specific entry point that coordinates view creation, rendering, and transport setup.

**Worker mode (default)**: The application runs in a worker thread; only rendering happens on the main thread:
- The application builds its view tree and emits **binary command batches** to the main thread.
- The main thread decodes and executes them with the renderer.
- The renderer forwards **events** back to the worker, where the application handles them.

The library stays **bundler-independent**: the application provides a worker entry module (bundled by its own bundler) that calls `startWorker(() => App)`. `bootstrapApplication` accepts the worker URL (or a pre-built `Worker`). Passing a `View` class instead runs everything on the main thread.

**Provides**:
- `bootstrapApplication(viewClass | workerUrl | worker)` - Single function to bootstrap an application
- `startWorker(loadView)` - Worker-side entry point
- `WorkerManager` - Main-thread worker lifecycle and message routing
- Automatically finds `<app-root>` element as container
- Sets up DOMRenderer automatically
- Configures command transport between view and renderer
- No configuration required for basic usage

**Example (worker mode):**
```typescript
// worker.ts (bundled as the worker by the application)
import { startWorker } from '@pathland/platform-browser/worker';
import App from './app';
startWorker(() => App);
```

```typescript
// main.ts
import { bootstrapApplication } from '@pathland/platform-browser';
import workerUrl from './worker?worker&url';
bootstrapApplication(workerUrl);
```

**HTML Requirement:**
```html
<body>
  <app-root></app-root>
</body>
```

**Does NOT provide**:
- Application logic (defined in view classes)
- Custom container selection (always uses `<app-root>`)
- Server-side rendering

**Depends on**: `@pathland/view`, `@pathland/renderer-dom`, `@pathland/transport`

### 5. `@pathland/renderer-dom` - DOM Renderer

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
- Non-browser rendering (e.g., server-side)
- Application logic
- Event handling implementation

**Depends on**: `@pathland/protocol`

**Statelessness**: Only maintains `Map<number, HTMLElement>` for event routing. All other state is derived from commands.

### 6. `@pathland/renderer-html` - HTML String Renderer

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

### 7. `@pathland/renderer-dom` - Unified DOM Renderer

**Responsibility**: Execute Pathland commands to create and manage DOM elements in both browser and Node.js (via JSDOM).

**Scope**: Any environment with DOM APIs - browsers, Node.js with JSDOM, testing, SSR.

**Provides**:
- `DOMRenderer` class - unified for all DOM environments
- Uses `document.createElement` from provided or global document
- Creates appropriate DOM elements for each component type
- Applies properties as CSS styles and attributes
- Maintains nodeId → element mapping for event routing
- `getHTML()` → full document HTML string (JSDOM only)
- `getBodyHTML()` → body content HTML string (JSDOM only)
- `getDocument()` → access to the document being used
- `createJSDOMRenderer()` → factory for Node.js/JSDOM, imported from the
  `@pathland/renderer-dom/jsdom` subpath (kept separate so browser bundles
  never include jsdom)
- Flex layout for HStack (row) and VStack (column)

**Does NOT provide**:
- Simple HTML string generation without DOM (see renderer-html for that)
- Transportation
- Application logic

**Depends on**: `@pathland/protocol`
**Optional peer dependency**: `jsdom` (for Node.js environments)

**Statelessness**: Only maintains `Map<number, RenderElement>` for event routing. All other state is derived from commands.

## Package Boundaries

| From \ To | protocol | renderer | transport | view | platform-browser | renderer-dom | renderer-html |
|-----------|----------|----------|-----------|------|-----------------|--------------|--------------|
| protocol | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| renderer | - | - | - | - | ✓ | ✓ | - |
| transport | - | - | - | ✓ | ✓ | - | - |
| view | - | - | - | - | ✓ | ✓ | ✓ |
| platform-browser | - | - | - | ✓ | - | ✓ | ✓ |
| renderer-dom | - | - | - | - | - | - | - |
| renderer-html | - | - | - | - | - | - | - |

**Dependency Rule**: Packages can only depend on packages to their left in the table above.

This ensures:
- `protocol` has no dependencies
- `renderer` only depends on `protocol` (shared `PointerInteraction` recognizer)
- `transport` only depends on `protocol`
- `view` depends on `protocol` and `transport`
- `platform-browser` depends on `view`, `renderer-dom`, and `transport`
- `renderer-dom` only depends on `protocol` and `renderer` (with optional `jsdom` peer dependency)
- `renderer-html` only depends on `protocol`

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

const renderer = new DOMRenderer({ container: document.getElementById('app') });

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
cd packages/platform-browser && npm publish
cd packages/renderer-dom && npm publish
cd packages/renderer-html && npm publish
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

### platform-browser/
```
src/
└── bootstrap.ts          # Bootstrap function
```

### renderer-dom/
```
src/
├── index.ts              # DOMRenderer class
├── components.ts         # Pathland custom elements (shadow DOM)
└── events.ts             # resolveNodeId (composed-path hit-testing)
```

### renderer-html/
```
src/
└── index.ts              # HTMLRenderer class
```


