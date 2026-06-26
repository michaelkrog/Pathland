# Pathland Binary Protocol

Pathland uses **FlatBuffers** as its official binary protocol for efficient, cross-platform communication between applications and renderers.

## 📁 Structure

```
spec/binary/
├── README.md              # This file
├── BINARY.md             # Binary protocol specification
└── flatbuffers/
    └── PATHLAND.fbs      # FlatBuffers schema definition
```

## 🎯 Quick Start

### 1. Get FlatBuffers Compiler

```bash
# Download pre-built compiler
wget https://github.com/google/flatbuffers/releases/download/v23.5.26/FlatBuffers-23.5.26-linux-x86_64.tar.gz
# Or install via package manager
# macOS: brew install flatbuffers
# Ubuntu: sudo apt-get install flatbuffers-compiler
```

### 2. Generate Code

```bash
# JavaScript
flatc --js spec/binary/flatbuffers/PATHLAND.fbs -o generated/

# TypeScript (with type generation)
flatc --ts spec/binary/flatbuffers/PATHLAND.fbs -o generated/

# C++
flatc --cpp spec/binary/flatbuffers/PATHLAND.fbs -o generated/

# Rust
flatc --rust spec/binary/flatbuffers/PATHLAND.fbs -o generated/
```

### 3. Use in Your Code

```javascript
import { flatbuffers } from 'flatbuffers';
import { Pathland } from './generated/PATHLAND_generated.js';

// Build a command batch
const builder = flatbuffers.createBuilder();
const cmd = Pathland.Command.createCommand(
  builder,
  Pathland.CommandType.Create,
  builder.createString("myButton"),
  Pathland.CreateData.createCreateData(builder, Pathland.ComponentType.Text)
);
const batch = Pathland.CommandBatch.createCommandBatch(builder, 0, [cmd]);
builder.finish(batch);

// Send as ArrayBuffer (transferable!)
worker.postMessage(builder.asArrayBuffer(), [builder.asArrayBuffer()]);
```

## 📖 Documentation

- **[BINARY.md](./BINARY.md)** - Complete binary protocol specification
- **[PATHLAND.fbs](./flatbuffers/PATHLAND.fbs)** - FlatBuffers schema definition

## ✨ Features

- **Zero-copy access**: Read data directly from buffers without parsing
- **High performance**: 5-10x faster than JSON
- **Compact**: 60-75% smaller than JSON
- **Transferable**: Works with ArrayBuffer transferable objects in browsers
- **Type-safe**: Compile-time type checking with code generation
- **Cross-platform**: Works on all platforms (browser, mobile, embedded)

## 🏗️ Schema Overview

The schema defines:

- **7 Command Types**: Create, AddChild, RemoveChild, Destroy, SetStyle, SetProperty, SetEventHandler
- **3 Component Types**: HStack, VStack, Text
- **All Data Types**: Length, Color, Point, Size, EdgeInsets, etc.
- **Style Types**: BackgroundStyle, BorderStyle, FontStyle, Gradient, etc.
- **Event Types**: Tap, Click, Hover, Focus, Keyboard, Scroll, Swipe

## 📊 Performance

| Metric | FlatBuffers | MessagePack | JSON |
|--------|-------------|-------------|------|
| Serialization | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Deserialization | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Size | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| Zero-copy | ✅ Yes | ❌ No | ❌ No |
| Schema required | ✅ Yes | ❌ No | ❌ No |

## 🎨 Example: Creating a Button

```javascript
// Application sends to Renderer
const builder = flatbuffers.createBuilder();

// Create button
const createCmd = Pathland.Command.createCommand(
  builder,
  Pathland.CommandType.Create,
  builder.createString("button1"),
  Pathland.CreateData.createCreateData(
    builder,
    Pathland.ComponentType.Text
  )
);

// Set content
const contentCmd = Pathland.Command.createCommand(
  builder,
  Pathland.CommandType.SetProperty,
  builder.createString("button1"),
  Pathland.SetPropertyData.createSetPropertyData(
    builder,
    builder.createString("content"),
    builder.createString("Click me")
  )
);

// Set background style
const styleCmd = Pathland.Command.createCommand(
  builder,
  Pathland.CommandType.SetStyle,
  builder.createString("button1"),
  Pathland.SetStyleData.createSetStyleData(
    builder,
    builder.createString("background"),
    Pathland.BackgroundStyle.createBackgroundStyle(
      builder,
      Pathland.Color.createColor(builder, builder.createString("#007AFF"))
    )
  )
);

// Build and send
const batch = Pathland.CommandBatch.createCommandBatch(
  builder,
  1,
  [createCmd, contentCmd, styleCmd]
);
builder.finish(batch);

// Transfer to renderer (zero-copy!)
renderer.postMessage(builder.asArrayBuffer(), [builder.asArrayBuffer()]);
```

## 🔄 Versioning

The binary protocol follows semantic versioning:
- **1.0.0-alpha**: Initial FlatBuffers schema

Backward compatibility is maintained through:
- Adding new enum values (never removing or changing existing ones)
- Adding new optional fields (never removing existing ones)
- Using unions for extensible data types

## 📦 Language Support

Code generation is available for:
- JavaScript/TypeScript
- C++
- Rust
- Python
- Go
- Java
- C#
- Swift
- Kotlin
- And more...

## 🎯 Use Cases

### Browser Web Workers
```javascript
// Main thread → Worker
worker.postMessage(buffer, [buffer]);

// Worker → Main thread
self.postMessage(buffer, [buffer]);
```

### WebSocket
```javascript
// Client → Server
socket.send(buffer);

// Server → Client
ws.send(buffer);
```

### Inter-Process Communication (IPC)
```rust
// Process A → Process B
let buffer = builder.finished_data();
channel.send(buffer).unwrap();
```

### Embedded Systems
```c
// Microcontroller communication
uint8_t* buffer = builder.GetBufferPointer();
size_t size = builder.GetSize();
send_over_uart(buffer, size);
```

## 🏆 Why FlatBuffers?

1. **Performance**: Zero-copy access means data is read directly from the buffer
2. **Efficiency**: Only the data you access is read from memory
3. **Flexibility**: Works with any transport (WebSocket, IPC, files, etc.)
4. **Standard**: Well-established, maintained by Google
5. **Portable**: Works on all platforms from browsers to microcontrollers
6. **Open**: Apache 2.0 license, no restrictions

## 📚 Resources

- [FlatBuffers Official Documentation](https://google.github.io/flatbuffers/)
- [FlatBuffers GitHub](https://github.com/google/flatbuffers)
- [FlatBuffers Tutorial](https://google.github.io/flatbuffers/md__docs_2tutorial.html)
