# @pathland/view

**Pathland View Framework** - Reactive, declarative UI for the Pathland binary protocol.

This package provides a component-based, Angular-like API for building UI that compiles to Pathland's binary protocol. It features **fine-grained reactivity** where only changed properties generate update commands - no tree diffing required.

## Features

- **Fine-grained reactivity** via Signals - only changed properties generate SET_PROPERTY commands
- **No tree diffing** - direct command generation for maximum efficiency
- **Chainable API** - fluent interface for building UI
- **Component-based** - reusable components with Angular-like syntax
- **Type-safe** - full TypeScript support with Pathland protocol types
- **Lightweight** - minimal runtime overhead

## Installation

```bash
npm install @pathland/view @pathland/protocol @pathland/transport
```

## Basic Usage

```typescript
import { VStack, HStack, Text, Signal, initialRender } from '@pathland/view';
import { PostMessageTransport } from '@pathland/transport';

// Create reactive state
const count = new Signal(0);

// Create your view
function createView() {
  return VStack(
    Text('Counter App'),
    Text(count.map(n => `Count: ${n}`)).fontSize(24),
    HStack(
      Text('-').tapGesture(() => count.set(count.get() - 1)),
      Text('+').tapGesture(() => count.set(count.get() + 1))
    ).spacing(8).padding(16)
  );
}

// Initialize with a transport
const transport = new PostMessageTransport(iframe.contentWindow);
const root = createView();
initialRender(root, transport);

// Later: changing the signal generates a SET_PROPERTY command
count.set(5); // Only this node's text property is updated
```

## Core Concepts

### Signals

Signals are reactive values that directly generate Pathland SET_PROPERTY commands when changed.

```typescript
// Create a signal
const count = new Signal(0);

// Get current value
const current = count.get();

// Set new value (generates command)
count.set(5);

// Map to derived value
const doubled = count.map(n => n * 2);

// Bind to a ViewNode property
Text(count.map(n => `Count: ${n}`)).bindSignal(count, 'text');
```

### ViewNode

The immutable node in the virtual UI tree. Each ViewNode has:
- `type`: Component type (VStack, HStack, Text, etc.)
- `nodeId`: Unique identifier (never changes for lifetime)
- `properties`: Key-value pairs for component properties
- `modifiers`: Styling modifiers (padding, background, etc.)
- `gestures`: Interaction handlers (tap, longPress, etc.)
- `children`: Child ViewNodes

### Chainable API

All ViewNodes support a fluent interface:

```typescript
Text('Hello')
  .fontSize(24)
  .color('primary')
  .padding(16)
  .background('surface')
  .tapGesture(() => console.log('Clicked!'));
```

### Component Factories

Core component factories:
- `VStack(...children)` - Vertical stack
- `HStack(...children)` - Horizontal stack
- `Text(content)` - Text component

## Angular-like Class Components

Create reusable components with class-based syntax:

```typescript
import { View, ViewNode, VStack, Text, Signal } from '@pathland/view';

class Card extends View {
  private expanded = new Signal(false);
  private title: string;

  constructor(title: string) {
    super();
    this.title = title;
  }

  toggle() {
    this.expanded.set(!this.expanded.get());
  }

  body(): ViewNode {
    return VStack(
      HStack(
        Text(this.title).fontSize(18),
        Text(this.expanded.get() ? '[-]' : '[+]')
          .tapGesture(() => this.toggle())
      ).justification('space-between'),
      this.expanded.get() ? Text('Expanded content') : undefined
    )
      .background('surface')
      .padding(8);
  }
}

// Usage
const card = Card.make('My Card');
```

## Gestures

Attach interaction handlers to ViewNodes:

```typescript
// Tap gesture
Text('Click me').tapGesture(() => console.log('Tapped!'));

// Long press gesture
Text('Press and hold').longPressGesture(() => console.log('Long pressed!'));

// Multiple gestures
Text('Interactive')
  .tapGesture(() => console.log('Tap'))
  .longPressGesture(() => console.log('Long press'));
```

## Modifiers

Apply styling and behavior modifiers:

```typescript
Text('Styled')
  .padding(16)
  .background('primary')
  .color('white')
  .fontSize(18)
  .fontWeight(600)
  .opacity(0.8)
  .margin(8)
  .gap(4);
```

### Stack Modifiers

- `spacing(value)` - Space between children
- `padding(value)` - Inner padding
- `alignment(value)` - Cross-axis alignment
- `justification(value)` - Main-axis justification
- `gap(value)` - Gap between children

### Style Modifiers

- `color(value)` - Text color
- `background(value)` - Background color
- `fontSize(value)` - Font size
- `fontWeight(value)` - Font weight
- `opacity(value)` - Opacity (0-1)
- `visible(value)` - Visibility
- `margin(value)` - Outer margin

## Conditional Rendering

Use signals to control visibility and content:

```typescript
const showMessage = new Signal(true);

VStack(
  showMessage.get() ? Text('Hello!') : undefined,
  Text(showMessage.map(v => v ? 'Hide' : 'Show'))
    .tapGesture(() => showMessage.set(!showMessage.get()))
);
```

## Initial Render

The `initialRender` function compiles the entire ViewNode tree to Pathland commands and sends them via the transport:

```typescript
import { initialRender } from '@pathland/view';
import { PostMessageTransport } from '@pathland/transport';

const transport = new PostMessageTransport(targetWindow);
const root = createView();
initialRender(root, transport);
```

## Transport

Commands are sent via a transport interface. The default implementation uses a queue that batches commands via `queueMicrotask`:

```typescript
import { commandQueue } from '@pathland/view';

// Set custom transport
commandQueue.setTransport({
  send: (commands) => {
    // Send to your renderer
    postMessage({ type: 'pathland', commands });
  }
});

// Flush immediately
commandQueue.flush();
```

## Performance Characteristics

### Fine-grained Reactivity

- Each Signal change generates **only** SET_PROPERTY commands for bound properties
- No tree diffing overhead
- No virtual DOM reconciliation
- Direct command generation from signal to protocol

### Comparison with Other Frameworks

| Framework | Reactivity Model | Diffing | Binary Protocol | Command Size |
|-----------|-----------------|---------|----------------|--------------|
| @pathland/view | Fine-grained Signals | None | Yes (Pathland) | Minimal |
| React 18 | Virtual DOM | Yes | No | Larger |
| Angular 21 | Signals/Change Detection | Yes | No | Larger |
| Vue 3 | Reactive Proxies | Yes | No | Medium |

### Performance for Large UI Trees

When running in a worker thread with PostMessageTransport:

1. **Initial render**: Full tree serialized once to binary
2. **Updates**: Only changed properties as SET_PROPERTY commands
3. **Transport**: Commands batched via transferable objects (no serialization overhead)
4. **Renderer**: Stateless execution of commands

This architecture provides:
- **Minimal memory usage** - no retained tree in renderer
- **Minimal CPU usage** - no diffing or reconciliation
- **Minimal bandwidth** - only changes transmitted
- **Predictable performance** - O(1) for updates (not O(n) like diffing)

## Example: Complete App with Worker

```typescript
// main.ts (main thread - renderer)
import { HTMLRenderer } from '@pathland/renderer-html';

const renderer = new HTMLRenderer();
const transport = {
  send: (commands) => renderer.execute(commands)
};

// Set up message handler from worker
addEventListener('message', (event) => {
  if (event.data.type === 'pathland') {
    renderer.execute(event.data.commands);
  }
});
```

```typescript
// worker.ts (worker thread - app logic)
import { VStack, Text, Signal, initialRender, commandQueue } from '@pathland/view';

const count = new Signal(0);

const root = VStack(
  Text(count.map(n => `Count: ${n}`)),
  Text('Increment').tapGesture(() => count.set(count.get() + 1))
);

// Set up transport to send to main thread
commandQueue.setTransport({
  send: (commands) => {
    postMessage({ type: 'pathland', commands });
  }
});

// Initial render
initialRender(root, commandQueue);

// Later updates will automatically send commands
count.set(5);
```

## API Reference

### Exports

```typescript
// Components
export { VStack, HStack, Text };

// Core
export { ViewNode, resetNodeIdCounter };

// Reactivity
export { Signal, commandQueue };

// Rendering
export { initialRender, handleDispatchEvent };

// Types
export type { Modifier, Gesture, PropertyValue, Command };

// Utilities
export { propertyNameToId, compilePropertyValue };
```

### ViewNode Methods

#### Construction
- `new ViewNode(type, children?, properties?, modifiers?, gestures?)`

#### Chainable Methods
- `withChildren(...children)` - Add children
- `withModifier(modifier)` - Add modifier
- `withGesture(gesture)` - Add gesture
- `withProperty(key, value)` - Set property
- `bindSignal(signal, propertyName, compile?)` - Bind signal to property

#### Modifiers (Chainable)
- `padding(value)` - Set padding
- `background(color)` - Set background color
- `color(color)` - Set text color
- `fontSize(value)` - Set font size
- `fontWeight(value)` - Set font weight
- `margin(value)` - Set margin
- `gap(value)` - Set gap
- `opacity(value)` - Set opacity
- `visible(value)` - Set visibility
- `visibleSignal(signal)` - Bind visibility to signal

#### Gestures (Chainable)
- `tapGesture(handler)` - Add tap gesture
- `longPressGesture(handler)` - Add long press gesture

### Signal Methods

- `constructor(initialValue)` - Create signal
- `get()` - Get current value
- `set(value)` - Set new value (generates commands)
- `map(fn)` - Create derived signal
- `bind(nodeId, propertyId, compile?)` - Bind to node property (returns unbind function)

### commandQueue Methods

- `add(...commands)` - Add commands to queue
- `flush()` - Immediately flush all commands
- `scheduleFlush()` - Schedule flush for next microtask
- `setTransport(transport)` - Set the transport for sending commands

## Design Philosophy

1. **Protocol First**: The binary protocol is the source of truth
2. **Renderer Stateless**: Renderers execute commands, they don't maintain state
3. **Fine-grained Updates**: Only changed properties generate commands
4. **No Diffing**: Direct command generation is more efficient than tree diffing
5. **Minimal Overhead**: No virtual DOM, no reconciliation, no unnecessary allocations

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

## License

MIT
