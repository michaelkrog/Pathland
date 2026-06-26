# Pathland Project - AI Agent Guide

This document provides essential context for AI agents (or human contributors) working on the **Pathland** protocol. It captures the project's direction, architectural decisions, and implementation details to ensure consistency.

**Last Updated**: June 26, 2026

---

## Project Vision

**Pathland is a cross-platform, cross-language UI protocol** that enables retained-mode UI development with multiple renderer backends. It is **protocol-first**, meaning the binary protocol specification is the source of truth, not any particular implementation.

**Primary Goal**: Write once, run anywhere - Enable UI code to be written once and deployed across web, mobile, desktop, and embedded platforms through different renderer implementations.

---

## CRITICAL ARCHITECTURAL PRINCIPLES

### Principle 1: Renderer Statelessness (NON-NEGOTIABLE)

> **The renderer MUST NOT maintain any application state.**

- Renderers are **pure functions** that execute commands
- The ONLY allowed state: a temporary mapping of `componentId -> renderedElement` **solely for event routing**
- NO virtual DOM, NO internal state representation, NO cached application state
- All state belongs to the **application**
- The application owns the canonical retained UI tree

**Violation of this principle is a bug, not a feature.**

### Principle 2: Command-Based Protocol (NON-NEGOTIABLE)

> **The protocol transmits tree mutations as a stream of commands, NOT as serialized trees.**

- Each message contains a **batch of commands** describing changes
- Only **actual changes** are transmitted
- Protocol acts like a **VM instruction stream** / ABI
- Deterministic, linear decoding without schema lookup or reflection

### Principle 3: Binary Protocol (NON-NEGOTIABLE)

> **The protocol MUST be binary.**

- Open-source, cross-platform binary format
- Works with ArrayBuffer via transferable objects in browsers
- Custom instruction-based bytecode, not schema-driven serialization

---

## Protocol Quick Reference

### Message Structure
```
Header (6 bytes):
  - version: u16 (2 bytes)
  - instructionCount: u32 (4 bytes)
Body: Sequence of binary-encoded commands
```

### Opcodes (u8)
| Opcode | Value | Status |
|--------|-------|--------|
| CREATE_NODE | 0x01 | Implemented |
| DELETE_NODE | 0x02 | Implemented |
| INSERT_CHILD | 0x03 | Implemented |
| REMOVE_CHILD | 0x04 | Implemented |
| SET_PROPERTY | 0x05 | Implemented |
| SET_DESIGN_TOKEN | 0x06 | Specified |

### Component Types (u16)
| Component | ID | Status |
|-----------|----|--------|
| HSTACK | 0x0001 | Implemented |
| VSTACK | 0x0002 | Implemented |
| TEXT | 0x0003 | Implemented |
| BUTTON | 0x0004 | Implemented |
| SPACER | 0x0008 | Implemented |

### Key Property IDs
**Stack**: SPACING=0x0001, ALIGNMENT=0x0002, JUSTIFICATION=0x0003, PADDING=0x0004  
**Text**: TEXT=0x000A, TEXT_ALIGNMENT=0x000C  
**Style**: COLOR=0x100A, FONT_SIZE=0x1007, FONT_WEIGHT=0x1008, BACKGROUND_COLOR=0x1001  
**Special**: WIDTH=0x100B (use -1=FILL, -2=HUG_CONTENT), OPACITY=0x100D, VISIBLE=0x100E

### Colors
- Tagged union: semantic token (u16) or literal sRGB (u32 0xAARRGGBB)
- ALL literal colors are **sRGB** with D65 white point
- Semantic tokens: PRIMARY_TEXT=0x0001, SECONDARY_TEXT=0x0002, BACKGROUND=0x0004, etc.

### Special Constants
```typescript
ROOT_CONTAINER_ID = 0
FILL = -1.0
HUG_CONTENT = -2.0
LITTLE_ENDIAN = true
```

---

## Design Token System

**Core Principle**: Application defines intent and overrides. Renderer defines visual appearance and behavior.

**Renderer Responsibilities**:
- Owns design tokens and default values
- Resolves semantic tokens to concrete visuals
- Defines interaction states (hover, pressed, focus, disabled)
- Applies theme logic

**Protocol MUST NEVER**:
- Describe hover styles, click styles, visual transitions
- Include conditional styling rules
- Specify layout tuning for interaction states

---

## POC Implementation

**Location**: `/poc/`

**Structure**:
```
poc/
├── index.html           # Demo page with 5 examples
├── src/
│   ├── application/     # Command generation
│   │   └── encoder.ts   # Binary encoding
│   ├── protocol/        # Protocol layer
│   │   ├── binary.ts    # Reader/writer
│   │   ├── constants.ts # All IDs/enums
│   │   └── decoder.ts   # Binary decoding
│   └── renderer/        # Stateless execution
│       ├── executor.ts  # Command execution
│       └── htmlRenderer.ts # HTML rendering
```

**Running**: `cd poc && npm install && npm run dev` (opens http://localhost:5173)

**5 Demos**:
1. Simple VStack with Text (semantic colors)
2. HStack with Spacer
3. Nested Stacks
4. Styled components (background, padding, opacity)
5. Live Clock (bold at :00/:10/:20/:30/:40/:50, optimized updates)

---

## Implementation Guidelines

### Adding New Component
1. Add to `ComponentType` enum in `constants.ts`
2. Add to `spec/components/COMPONENTS.md`
3. Implement in `executor.ts` `createElement()`
4. Add property handling in `executor.ts` `applyProperty()`

### Adding New Property
1. Add to appropriate property enum in `constants.ts`
2. Add to spec
3. Verify encoder/decoder handles value type
4. Implement in renderer's `applyProperty()`

### Modifying Protocol
1. Update `spec/BINARY_PROTOCOL.md` first
2. Update `constants.ts`
3. Update encoder/decoder if needed
4. Verify backward compatibility
5. Test all demos

---

## Common Pitfalls

### NEVER Do These
| Anti-Pattern | Why Wrong | Correct |
|--------------|-----------|---------|
| Renderer stores state | Violates statelessness | App owns state |
| Send full trees | Inefficient | Send mutation commands only |
| String property names | Larger payloads | Use numeric IDs |
| String component names | Larger payloads | Use numeric IDs |
| Generic RGB | Ambiguous | Explicitly sRGB |
| Hover styles in protocol | Renderer job | Define in theme |

---

## Project Status

**Complete**: Binary protocol, HTML renderer, 5 demos, command encoding/decoding

**Planned**: Event handling, signals, more components, additional backends

---

## Quick Start

1. Read this file and `spec/BINARY_PROTOCOL.md`
2. Run POC: `cd poc && npm install && npm run dev`
3. Test demos, check console and protocol inspection
4. Make small changes, verify they work

---

## Pathland Mindset

**Always remember**:
1. Protocol is King
2. Renderers are Dumb (execute commands only)
3. Applications are Smart (own state, generate commands)
4. Only Changes Matter (transmit mutations, not state)
5. Binary is Beautiful (efficient, deterministic)

**When in doubt**: Check `spec/BINARY_PROTOCOL.md` and POC implementation. Ask: "Does this maintain stateless renderers?" "Does this only transmit actual changes?"
