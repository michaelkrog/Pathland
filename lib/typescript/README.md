# Pathland TypeScript Libraries

[![npm](https://img.shields.io/npm/v/@pathland/protocol)](https://www.npmjs.com/package/@pathland/protocol)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Pathland** is a cross-platform, cross-language UI protocol that enables retained-mode UI development with multiple renderer backends. This monorepo contains the TypeScript implementation of the Pathland protocol, organized as independent, focused packages.

## Packages

This monorepo contains the following packages:

| Package | Description | Dependencies |
|---------|-------------|--------------|
| [`@pathland/protocol`](packages/protocol) | Core protocol - binary encoding/decoding | None |
| [`@pathland/transport`](packages/transport) | Message transportation (WebSocket, postMessage, etc.) | `@pathland/protocol` |
| [`@pathland/view`](packages/view) | Reactive view framework - component-based UI with signals | `@pathland/protocol`, `@pathland/transport` |
| [`@pathland/platform-browser`](packages/platform-browser) | Browser bootstrap - simple application entry point | `@pathland/view`, `@pathland/renderer-dom`, `@pathland/transport` |
| [`@pathland/renderer-dom`](packages/renderer-dom) | Unified DOM rendering for browsers and Node.js (JSDOM) | `@pathland/protocol` (peer: `jsdom`) |

See the full [../SPECIFICATION.md](../SPECIFICATION.md) for detailed package boundaries and responsibilities.

## Quick Start

### Installation

Install individual packages as needed:

```bash
# Core protocol (required for all use cases)
npm install @pathland/protocol

# For browser DOM rendering
npm install @pathland/renderer-dom

# For message transportation
npm install @pathland/transport

# For reactive view framework
npm install @pathland/view

# For browser bootstrap (recommended)
npm install @pathland/platform-browser
```

Or install everything:

```bash
npm install @pathland/protocol @pathland/transport @pathland/view @pathland/platform-browser @pathland/renderer-dom
```

### Basic Usage

#### 1. Encode and Decode Messages

```typescript
import { encodeMessage, decodeMessage, ComponentType, Opcode } from '@pathland/protocol';

// Create commands to build a simple UI
const commands = [
  {
    opcode: Opcode.CREATE_NODE,
    nodeId: 1,
    componentType: ComponentType.VSTACK,
    properties: new Map()
  },
  {
    opcode: Opcode.CREATE_NODE,
    nodeId: 2,
    componentType: ComponentType.TEXT,
    properties: new Map([
      [0x000A, { type: 'string', value: 'Hello, Pathland!' }] // TextProperty.TEXT
    ])
  },
  {
    opcode: Opcode.INSERT_CHILD,
    parentId: 1,
    childId: 2,
    index: 0
  }
];

// Encode to binary
const binaryMessage = encodeMessage(commands);

// Decode back to commands
const { version, commands: decodedCommands } = decodeMessage(binaryMessage);
```

#### 2. Render to DOM (Browser)

```typescript
import { decodeMessage } from '@pathland/protocol';
import { DOMRenderer } from '@pathland/renderer-dom';

// Create renderer attached to a DOM element
const renderer = new DOMRenderer({ container: document.getElementById('app') });

// Receive and render binary messages
function handleMessage(binaryBuffer: Uint8Array) {
  const { commands } = decodeMessage(binaryBuffer);
  renderer.executeCommands(commands);
}
```



renderer.executeCommands(commands);
const html = renderer.render();
```

#### 4. Render with JSDOM (Node.js)

```typescript
import { decodeMessage } from '@pathland/protocol';
import { DOMRenderer } from '@pathland/renderer-dom';

const renderer = DOMRenderer.createJSDOMRenderer();
const { commands } = decodeMessage(binaryBuffer);

renderer.executeCommands(commands);

// Get HTML string
const html = renderer.getBodyHTML();

// Access DOM APIs
const document = renderer.getDocument();
```

#### 5. Use Transportation

```typescript
import { encodeMessage } from '@pathland/protocol';
import { WebSocketTransport } from '@pathland/transport';

// Create WebSocket transport
const transport = new WebSocketTransport('ws://localhost:8080');

// Send commands
transport.send(commands);

// Receive commands
transport.onMessage(({ commands }) => {
  renderer.executeCommands(commands);
});
```

#### 6. Use View Framework (Reactive UI)

```typescript
import { VStack, Text, Signal, initialRender } from '@pathland/view';
import { PostMessageTransport } from '@pathland/transport';

// Create reactive state
const count = new Signal(0);

// Create view with signals
const root = VStack(
  Text('Counter: '),
  Text(count.map(n => n.toString())).fontSize(24),
  Text('Increment').tapGesture(() => count.set(count.get() + 1))
);

// Initialize with transport
const transport = new PostMessageTransport(targetWindow);
initialRender(root, transport);

// Updates automatically generate commands
count.set(5); // Generates SET_PROPERTY for the text node
```

#### 7. Use Platform Browser Bootstrap (Recommended)

```typescript
import { bootstrapApplication } from '@pathland/platform-browser';
import { App } from './app';

// Single line - that's it!
bootstrapApplication(App);
```

With HTML:
```html
<body>
  <app-root></app-root>
</body>
```

This automatically:
- Finds the `<app-root>` element
- Sets up DOMRenderer
- Configures command transport
- Initializes your application

## Development

### Build

```bash
# Build all packages
npm run build

# Build a specific package
cd packages/protocol && npm run build
```

### Project Structure

```
lib/typescript/
├── package.json                 # Monorepo root
├── README.md                    # This file
├── SPECIFICATION.md            # Full library specification
├── README.md                    # This file
└── packages/
    ├── protocol/
    │   ├── src/
    │   │   └── protocol/
    │   │       ├── constants.ts  # All protocol constants
    │   │       ├── types.ts      # TypeScript types
    │   │       └── binary.ts     # Binary encoding/decoding
    │   └── package.json
    ├── transport/
    │   ├── src/
    │   │   └── index.ts
    │   └── package.json
    ├── view/
    │   ├── src/
    │   │   ├── index.ts        # Public exports
    │   │   ├── signal.ts       # Signal reactivity
    │   │   ├── view-node.ts    # ViewNode class
    │   │   ├── components.ts   # Component factories
    │   │   ├── renderer.ts     # Initial render
    │   │   └── utils.ts        # Shared utilities
    │   ├── example/
    │   │   ├── simple-app.ts   # Simple usage example
    │   │   └── advanced-app.ts # Angular-like example
    │   ├── README.md           # Package documentation
    │   └── package.json
    ├── platform-browser/
    │   ├── src/
    │   │   └── bootstrap.ts    # Bootstrap function
    │   └── package.json
    ├── renderer-dom/
    │   ├── src/
    │   │   └── index.ts
    │   └── package.json

```

### Adding a New Package

1. Create the package directory under `packages/`
2. Add a `package.json` with name, description, and dependencies
3. Add TypeScript source files under `src/`
4. Add the package to the monorepo `package.json` workspaces
5. Update the build script in root `package.json`
6. Follow the dependency rules from SPECIFICATION.md

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Please read the [AGENTS.md](/AGENTS.md) file for project guidelines and architectural principles.

## Key Principles

This library follows the core Pathland principles:

1. **Protocol is King** - The binary protocol specification is the source of truth
2. **Renderers are Dumb** - They execute commands only, maintaining minimal state
3. **Applications are Smart** - They generate commands and own the UI tree
4. **Only Changes Matter** - The protocol transmits mutations, not full trees
5. **Binary is Beautiful** - Efficient, deterministic binary encoding
