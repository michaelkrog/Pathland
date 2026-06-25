# Pathland Agents Documentation

This document provides instructions for AI agents (or human contributors) to understand and contribute to the **Pathland** project.

---

## Overview

**Pathland** is a **cross-platform, cross-language UI protocol** designed to enable **retained-mode UI development** with **multiple renderer backends** (e.g., browser-JavaScript, SwiftUI, Jetpack Compose, LVGL). It is inspired by **SwiftUI** and prioritizes **simplicity, performance, and portability**.

Pathland avoids React-like patterns (e.g., no `useSignal`, `useState`, or `new` for each view) and favors a **declarative, TypeScript/TSX-friendly syntax**.

---

## Core Principles

### 1. Stateless Command-Based Renderers ⭐

**CRITICAL**: Pathland uses a **command-based protocol** where renderers execute commands rather than receiving complete trees.

A renderer is a pure function that:
- Takes **command batches** as input (not component trees)
- Executes each command in order
- Produces rendered output
- The ONLY exception: maintains a temporary mapping of component IDs to rendered elements **solely for event routing**
- Does NOT store, cache, or manage any application state
- Does NOT maintain a virtual DOM or internal state representation

**Key Architecture:**
- Application manages state (signals) and generates commands
- Commands describe changes: create, addChild, setModifier, setContent, remove, destroy
- Renderer executes commands statelessly
- Only actual changes are transmitted (efficient)

All state (signals, computed values, etc.) is managed **externally** by the application or framework.

### 2. Protocol-First

Pathland defines a **standardized, open protocol** for UI components, state, and events. This allows any language or platform to implement a renderer, ensuring **interoperability** and **flexibility**.

### 3. Retained-Mode UI

UI is defined as a **tree of components** with state and lifecycle, not immediate-mode drawing. This approach aligns with modern UI frameworks like SwiftUI and Jetpack Compose.

### 4. Renderer-Agnostic

Pathland supports **server-owned, SSR, prerendered, and client-rendered** apps simultaneously via different backends. This ensures that apps can run in diverse environments without modification.

### 5. Minimal Runtime

Pathland aims for a **lightweight JSX runtime** that supports scoped state and aligns with SwiftUI’s design principles (e.g., signals, not hooks).

### 6. No React Patterns

Pathland explicitly avoids React-like abstractions (e.g., `useState`, `useEffect`) in favor of simpler, more predictable paradigms.

---

## Goals

- **Write Once, Run Anywhere:** Enable UI code to be written once and deployed across platforms (web, mobile, embedded).
- **First-Class TypeScript/TSX Support:** Provide a syntax that is closer to SwiftUI than React, with strong typing and developer ergonomics.
- **Buildtime Generation:** Support generating specifications and documentation at buildtime to avoid runtime overhead.
- **Open-Source Collaboration:** Foster a community-driven approach with a focus on extensibility and performance.

---

## Non-Goals

- Replacing low-level graphics protocols (e.g., Wayland, X11).
- Tying the project to a specific language or framework (e.g., React Native, Flutter).
- Supporting imperative UI paradigms.

---

## Key Terms


| Term         | Definition                                                                 |
| ------------ | -------------------------------------------------------------------------- |
| **Signal**   | Reactive state (preferred over terms like "observable" or "atom").         |
| **Renderer** | Backend implementation (e.g., for web, iOS, Android, or embedded systems). |
| **Scope**    | Isolated context for state and components.                                 |
| **Protocol** | The standardized definition of UI components, state, and events.           |


---

## Inspirations

Pathland draws inspiration from:

- **SwiftUI** (declarative syntax, retained-mode UI)
- **Jetpack Compose** (cross-platform UI toolkit)
- **LVGL** (lightweight graphics library for embedded systems)
- **Linear, Notion, Cursor** (simplicity and modern design)

---

## How to Contribute

1. **Understand the Protocol:** Familiarize yourself with the Pathland protocol and its design principles.
2. **Follow the Syntax:** Use the **TypeScript/TSX syntax** and avoid React-like patterns.
3. **Respect the Core Principles:** Ensure your contributions align with Pathland’s goals and non-goals.
4. **Test Across Renderers:** Verify that your changes work with multiple renderer backends.
5. **Document Your Work:** Provide clear documentation and examples for new features or changes.

---

## Example Usage

```tsx
// Example Pathland component
import { Signal, View, Text } from "@pathland/core";

const counter = new Signal(0);

export function Counter() {
  return (
    <View>
      <Text>{counter.value}</Text>
      <button onClick={() => counter.value++}>Increment</button>
    </View>
  );
}
```

---

## Resources

- [Pathland GitHub Repository](#)
- [Protocol Specification](#)
- [Contribution Guidelines](#)
- [Community Discussions](#)

---

*Last updated: June 25, 2026*
