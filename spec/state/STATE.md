# Pathland State Management Specification

This document provides detailed specifications for the Pathland state management system.

## 1. State Management Overview

### 1.1 Design Principles

The Pathland state management system is designed to be:

- **Reactive**: State changes automatically trigger UI updates
- **Language-agnostic**: Can be implemented in any programming language
- **Predictable**: State changes follow clear, deterministic rules
- **Efficient**: Minimizes unnecessary re-renders
- **Scalable**: Works for both small and large applications
- **Renderer-Agnostic**: State is managed **completely separately** from rendering

### 1.2 Core Principles

**State and Rendering are Completely Separate:**

> **Renderers do not manage state. Period.**

- All state (signals, computed values, effects) is managed by the **application or framework**
- The renderer is a **stateless pure function** that only renders the current component tree
- When state changes, the **application** rebuilds the component tree and passes it to the renderer
- The renderer has **no knowledge** of signals, state updates, or dependencies

### 1.3 Core Concepts

Pathland uses a **signal-based** state management system:

1. **Signals**: Hold state values and notify dependents when they change
2. **Computed Signals**: Derived values that update automatically when their dependencies change
3. **Effects**: Side effects that run in response to state changes
4. **Scopes**: Isolated state contexts
5. **Component Tree**: The output of state → UI transformation, passed to the renderer

### 1.3 State Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      STATE FLOW                                 │
├─────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. STATE UPDATE                                                │
│     Signal.value = newValue                                    │
│        │                                                        │
│        ▼                                                        │
│                                                                  │
│  2. VERSION INCREMENT                                           │
│     Signal.version++                                            │
│        │                                                        │
│        ▼                                                        │
│                                                                  │
│  3. NOTIFY DEPENDENTS                                           │
│     For each dependent:                                        │
│        - If ComputedSignal: recompute()                        │
│        - If Effect: run()                                       │
│        - If Component: mark for re-render                       │
│        │                                                        │
│        ▼                                                        │
│                                                                  │
│  4. RE-RENDER AFFECTED COMPONENTS                              │
│     Renderer updates only components that depend on         │
│     the changed signal                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────┘
```

## 2. Signals

### 2.1 Signal Structure

A signal is a container for a value that can change over time:

```json
{
  "id": <string>,
  "name": <string>,
  "value": <any>,
  "version": <number>,
  "computed": <boolean>,
  "dependencies": [<string>],
  "dependents": [<string>]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for the signal |
| `name` | string | No | Human-readable name for debugging |
| `value` | any | Yes | Current value of the signal |
| `version` | number | Yes | Version counter, incremented on each change |
| `computed` | boolean | Yes | Whether this is a computed signal |
| `dependencies` | array of string | No | IDs of signals this signal depends on (for computed signals) |
| `dependents` | array of string | No | IDs of signals/components that depend on this signal |

### 2.2 Signal Types

#### 2.2.1 State Signal

A **state signal** holds a value that can be set directly:

```json
{
  "id": "counter",
  "name": "Counter",
  "value": 0,
  "version": 1,
  "computed": false,
  "dependents": ["counter-display"]
}
```

**Operations:**
- `get()`: Returns the current value
- `set(newValue)`: Sets a new value and triggers updates
- `update(fn)`: Updates the value using a function (fn receives current value)

#### 2.2.2 Computed Signal

A **computed signal** holds a value that is derived from other signals:

```json
{
  "id": "double-counter",
  "name": "Double Counter",
  "value": 0,
  "version": 1,
  "computed": true,
  "dependencies": ["counter"],
  "dependents": ["double-display"]
}
```

**Operations:**
- `get()`: Returns the current computed value
- `compute()`: Recomputes the value from dependencies (called automatically)

**Computation Function:**
The computation function is implementation-defined but SHOULD:
- Be pure (no side effects)
- Only depend on the signals in its `dependencies` list
- Return the same value for the same dependency values

### 2.3 Signal Creation

Signals are created through implementation-specific APIs. The protocol does not specify the exact creation mechanism, but implementations SHOULD support:

1. Creating state signals with initial values
2. Creating computed signals with computation functions
3. Creating signals within specific scopes

### 2.4 Signal Updates

When a signal's value changes:

1. The new value is stored
2. The `version` is incremented
3. All dependents are notified
4. Affected components are marked for re-render

**Update Rules:**
- Updates are synchronous by default
- Implementations MAY support asynchronous updates
- Updates should be batched when possible for performance

### 2.5 Signal Equality

When setting a new value, implementations SHOULD check for equality:

- If the new value is equal to the current value (using deep equality for objects/arrays), the update is skipped
- This prevents unnecessary re-renders
- The equality check is implementation-defined

## 3. State Management in Components

### 3.1 Component State

Each component can have its own state signals:

```json
{
  "type": "text",
  "id": "counter-display",
  "content": "Count: 0",
  "state": {
    "counter": {
      "id": "counter",
      "value": 0,
      "version": 1
    }
  }
}
```

### 3.2 State Access in Components

Components can access state signals through implementation-specific mechanisms. The protocol does not specify the exact mechanism, but implementations SHOULD support:

1. Reading signal values
2. Subscribing to signal changes
3. Updating signal values

### 3.3 State Scope

State can be scoped to different levels:

| Scope | Description | Lifetime |
|-------|-------------|----------|
| **Global** | Available to all components | Application lifetime |
| **Component** | Available only to a component and its children | Component lifetime |
| **Tree** | Available to a subtree of components | Subtree lifetime |

**Scope Inheritance:**
- Child components can access state from parent scopes
- State updates in a child scope do not affect parent scopes
- Implementations SHOULD provide a way to create isolated scopes

## 4. Computed Signals

### 4.1 Computed Signal Creation

A computed signal is created with a computation function that depends on other signals:

```json
{
  "id": "full-name",
  "name": "Full Name",
  "computed": true,
  "dependencies": ["first-name", "last-name"],
  "compute": "function(firstName, lastName) { return firstName + ' ' + lastName; }"
}
```

**Note:** The `compute` field representation is implementation-defined.

### 4.2 Computed Signal Behavior

When a dependency changes:

1. The computed signal's `compute` function is called
2. The new value is stored
3. The `version` is incremented
4. All dependents are notified

**Lazy Evaluation:**
- Computed signals SHOULD be evaluated lazily (only when their value is needed)
- Implementations MAY cache the computed value until dependencies change

### 4.3 Circular Dependencies

Implementations MUST detect and handle circular dependencies:

- Circular dependencies between computed signals should be detected at creation time
- Implementations SHOULD either:
  - Throw an error
  - Use a placeholder value
  - Break the cycle by using the previous value

## 5. Effects

### 5.1 Effect System

Effects are side effects that run in response to state changes:

```json
{
  "id": "log-effect",
  "type": "effect",
  "dependencies": ["counter"],
  "run": "function(counter) { console.log('Counter changed:', counter); }"
}
```

**Note:** The `run` field representation is implementation-defined.

### 5.2 Effect Types

| Type | Description | Timing |
|------|-------------|--------|
| **Immediate** | Runs immediately when dependencies change | Synchronous |
| **Deferred** | Runs after all state updates are complete | After current batch |
| **Async** | Runs asynchronously | Implementation-defined |

### 5.3 Effect Cleanup

Effects MAY have cleanup functions that run when:
- The effect is removed
- The effect's dependencies change (before running the new effect)

```json
{
  "id": "subscription-effect",
  "type": "effect",
  "dependencies": ["user-id"],
  "run": "function(userId) { return subscribe(userId, callback); }",
  "cleanup": "function(subscription) { subscription.unsubscribe(); }"
}
```

## 6. State Updates and Events

### 6.1 State Updates from Events

State can be updated in response to events:

```json
{
  "type": "text",
  "id": "increment-button",
  "content": "Increment",
  "events": {
    "onTap": "function() { counter.set(counter.get() + 1); }"
  }
}
```

**Note:** The event handler representation is implementation-defined.

### 6.2 Event Data in State Updates

Event data can be used in state updates:

```json
{
  "type": "text",
  "id": "input-field",
  "content": "",
  "events": {
    "onKeyDown": "function(event) { if (event.data.key === 'Enter') { submit(); } }"
  }
}
```

## 7. State Serialization

### 7.1 Serializable State

State signals can be serialized for:
- Saving application state
- Sharing state between components
- Debugging

**Serializable Format:**

```json
{
  "signals": [
    {
      "id": "counter",
      "name": "Counter",
      "value": 5,
      "version": 10
    },
    {
      "id": "user-name",
      "name": "User Name",
      "value": "John Doe",
      "version": 3
    }
  ]
}
```

### 7.2 Non-Serializable State

Some state may not be serializable:
- Function references
- DOM nodes
- Platform-specific objects
- Circular references

Implementations SHOULD handle non-serializable state gracefully:
- Skip non-serializable fields
- Provide placeholder values
- Warn or error appropriately

## 8. State Synchronization

### 8.1 Cross-Component State

Multiple components can share state:

```json
{
  "type": "vstack",
  "id": "app",
  "state": {
    "shared-counter": {
      "id": "shared-counter",
      "value": 0
    }
  },
  "children": [
    {
      "type": "text",
      "id": "counter-display",
      "content": "Count: 0",
      "state": {
        "counter": {"ref": "shared-counter"}
      }
    },
    {
      "type": "text",
      "id": "increment-button",
      "content": "Increment",
      "events": {
        "onTap": "function() { shared-counter.set(shared-counter.get() + 1); }"
      }
    }
  ]
}
```

### 8.2 State Inheritance

Child components can inherit state from parent components:

```json
{
  "type": "vstack",
  "id": "parent",
  "state": {
    "theme": {
      "id": "theme",
      "value": "light"
    }
  },
  "children": [
    {
      "type": "text",
      "id": "child",
      "content": "Hello",
      "state": {
        "theme": {"ref": "../theme"}
      }
    }
  ]
}
```

## 9. Performance Optimizations

### 9.1 Batching Updates

Implementations SHOULD batch multiple state updates:

```
// Without batching:
signal1.set(value1); // Triggers re-render
signal2.set(value2); // Triggers re-render

// With batching:
batch(() => {
  signal1.set(value1); // No re-render yet
  signal2.set(value2); // No re-render yet
}); // Triggers single re-render
```

### 9.2 Lazy Evaluation

Computed signals SHOULD be evaluated lazily:
- Only when their value is actually needed
- Cached until dependencies change

### 9.3 Fine-Grained Updates

Implementations SHOULD only re-render components that depend on changed state:
- Track dependencies between components and signals
- Only update affected subtrees
- Avoid unnecessary re-renders

### 9.4 Memoization

Implementations MAY memoize:
- Computed signal values
- Component render outputs
- Expensive computations

## 10. Debugging State

### 10.1 State Inspection

Implementations SHOULD provide a way to inspect state for debugging:
- List all signals
- View signal values and versions
- View dependency graphs
- Track state changes over time

### 10.2 State Change Logging

Implementations SHOULD provide a way to log state changes:
- Log when signals are created
- Log when signals are updated
- Log when computed signals are recomputed
- Log when effects run

### 10.3 Time Travel Debugging

Implementations MAY support time travel debugging:
- Record state changes
- Replay state changes
- Jump to specific points in time

## 11. Security Considerations

### 11.1 State Validation

Implementations SHOULD validate state:
- Check for circular dependencies
- Check for invalid values
- Check for excessive state size

### 11.2 State Isolation

Implementations SHOULD isolate state between:
- Different applications
- Different users
- Different scopes

### 11.3 Sensitive State

Implementations SHOULD handle sensitive state carefully:
- Don't log sensitive state
- Don't serialize sensitive state
- Respect platform security policies

## 12. Testing State

### 12.1 State Testing

Implementations SHOULD provide a way to test state:
- Set initial state for tests
- Trigger state changes
- Assert state values
- Test computed signals

### 12.2 State Mocking

Implementations SHOULD provide a way to mock state for testing:
- Mock signal values
- Mock computed signal computations
- Mock effect side effects

## Appendix A: Example State Management

```json
// Complete example with state management
{
  "type": "vstack",
  "id": "counter-app",
  "state": {
    "count": {
      "id": "count",
      "name": "Count",
      "value": 0,
      "version": 1
    },
    "double-count": {
      "id": "double-count",
      "name": "Double Count",
      "value": 0,
      "version": 1,
      "computed": true,
      "dependencies": ["count"],
      "compute": "function(count) { return count * 2; }"
    }
  },
  "modifiers": {
    "gap": 16,
    "alignment": "center",
    "padding": {"all": 20}
  },
  "children": [
    {
      "type": "text",
      "id": "count-display",
      "content": "Count: 0",
      "modifiers": {
        "font": {"size": 24, "weight": "bold"}
      }
    },
    {
      "type": "text",
      "id": "double-display",
      "content": "Double: 0",
      "modifiers": {
        "font": {"size": 18}
      }
    },
    {
      "type": "hstack",
      "modifiers": {
        "gap": 8
      },
      "children": [
        {
          "type": "text",
          "id": "decrement-button",
          "content": "-",
          "modifiers": {
            "font": {"size": 24},
            "padding": {"horizontal": 20, "vertical": 10},
            "background": {"color": "#FF3B30"},
            "border": {"radius": 8}
          },
          "events": {
            "onTap": "function() { count.set(count.get() - 1); }"
          }
        },
        {
          "type": "text",
          "id": "increment-button",
          "content": "+",
          "modifiers": {
            "font": {"size": 24},
            "padding": {"horizontal": 20, "vertical": 10},
            "background": {"color": "#34C759"},
            "border": {"radius": 8}
          },
          "events": {
            "onTap": "function() { count.set(count.get() + 1); }"
          }
        }
      ]
    }
  ]
}
```

## Appendix B: State Update Flow

```
1. User taps increment button
2. onTap handler is called
3. count.set(count.get() + 1) is executed
4. count signal updates:
   - value: 0 -> 1
   - version: 1 -> 2
5. count notifies dependents:
   - double-count (computed signal)
   - count-display (component)
6. double-count recomputes:
   - value: 0 -> 2 (1 * 2)
   - version: 1 -> 2
   - notifies double-display
7. Renderer marks components for re-render:
   - count-display
   - double-display
8. Renderer re-renders affected components
```

## Appendix C: State Type Summary

| Type | Description | Mutable | Dependencies |
|------|-------------|---------|--------------|
| State Signal | Holds a direct value | Yes | No |
| Computed Signal | Derived from other signals | No | Yes |
| Effect | Side effect | N/A | Yes |
