# Pathland Event System Specification

**Version:** 2.0.0-alpha  
**Status:** Draft  
**Last Updated:** June 26, 2026

> **IMPORTANT**: This document provides detailed specifications for the Pathland event system. The **[BINARY_PROTOCOL.md](../BINARY_PROTOCOL.md)** specification is the **sole authoritative source** for all protocol details including event opcodes, event type IDs, and binary encoding formats. The JSON representations in this document are for **illustrative purposes only** and must not be used for implementation.

---

## 1. Event System Overview

### 1.1 Design Principles

The Pathland event system is designed to be:

- **Platform-agnostic**: Works across different input modalities (touch, mouse, keyboard, etc.)
- **Language-agnostic**: Can be implemented in any programming language
- **Extensible**: Supports custom event types
- **Predictable**: Consistent behavior across implementations
- **Flexible**: Supports various event propagation patterns

### 1.2 Event Flow

The event flow in Pathland follows a three-phase model:

```
┌─────────────────────────────────────────────────────────────┐
│                      EVENT FLOW                                │
├─────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CAPTURE PHASE (optional)                                   │
│     Root ──► Child ──► Target                                  │
│        │        │        │                                    │
│        ▼        ▼        ▼                                    │
│                                                                  │
│  2. TARGET PHASE                                                │
│     Target (event handlers execute)                           │
│        │                                                        │
│        ▼                                                        │
│                                                                  │
│  3. BUBBLE PHASE                                                │
│     Target ──► Child ──► Root                                  │
│        │        │        │                                    │
│        ▼        ▼        ▼                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Event Propagation Control

Event handlers can control propagation through the following actions:

| Action | Description | Effect |
|--------|-------------|--------|
| `stopPropagation()` | Stop event from propagating further | Stops both capture and bubble phases |
| `stopImmediatePropagation()` | Stop other handlers on same component | Prevents other handlers on the same component from executing |
| `preventDefault()` | Prevent default action | Prevents the platform's default behavior |

---

## 2. Event Types

### 2.1 Core Event Types

> **IMPORTANT**: The JSON representations below are **illustrative only**. For actual implementation, use the **binary encoding** defined in **[BINARY_PROTOCOL.md - Event Type Table](../BINARY_PROTOCOL.md#event-type-table)**.

Pathland defines the following core event types that MUST be supported by all conforming implementations:

#### 2.1.1 Pointer Events

##### Tap Event

**Type:** `TAP`  
**Binary Type ID:** `0x01`  
**Platforms:** Touch, Mouse  
**Description:** A single tap/click action

**Note:** The JSON structure below is for illustration only. Use the binary format from BINARY_PROTOCOL.md.

```json
{
  "type": "tap",
  "timestamp": <number>,
  "target": <string>,
  "path": [<string>],
  "data": {
    "location": {
      "x": <number>,
      "y": <number>
    },
    "tapCount": <number>
  }
}
```

**Binary Encoding:** See **[BINARY_PROTOCOL.md - Event Type Table](../BINARY_PROTOCOL.md#event-type-table)** for the authoritative binary format.

##### Double Tap Event

**Type:** `DOUBLE_TAP`  
**Binary Type ID:** `0x02`  
**Platforms:** Touch, Mouse  
**Description:** A double tap/click action (two taps in quick succession)

##### Long Press Event

**Type:** `LONG_PRESS`  
**Binary Type ID:** `0x03`  
**Platforms:** Touch  
**Description:** A sustained press that exceeds a platform-specific duration threshold

##### Click Event

**Type:** `CLICK`  
**Binary Type ID:** `0x04`  
**Platforms:** Mouse, Trackpad  
**Description:** A mouse click with button information

##### Hover Event

**Type:** `HOVER`  
**Binary Type ID:** `0x05`  
**Platforms:** Mouse, Trackpad, Stylus  
**Description:** Mouse pointer enters or leaves a component

#### 2.1.2 Focus Events

##### Focus Event

**Type:** `FOCUS`  
**Binary Type ID:** `0x06`  
**Platforms:** All  
**Description:** A component gains focus

##### Blur Event

**Type:** `BLUR`  
**Binary Type ID:** `0x07`  
**Platforms:** All  
**Description:** A component loses focus

#### 2.1.3 Keyboard Events

##### Key Down Event

**Type:** `KEY_DOWN`  
**Binary Type ID:** `0x08`  
**Platforms:** All  
**Description:** A key is pressed down

##### Key Up Event

**Type:** `KEY_UP`  
**Binary Type ID:** `0x09`  
**Platforms:** All  
**Description:** A key is released

#### 2.1.4 Scroll Events

##### Scroll Event

**Type:** `SCROLL`  
**Binary Type ID:** `0x0A`  
**Platforms:** Mouse wheel, Touchpad, Touch screen  
**Description:** A scroll action occurs

#### 2.1.5 Gesture Events

##### Swipe Event

**Type:** `SWIPE`  
**Binary Type ID:** `0x0B`  
**Platforms:** Touch  
**Description:** A swipe gesture is detected

#### 2.1.6 Lifecycle Events

##### On Appear Event

**Type:** `ON_APPEAR`  
**Binary Type ID:** `0x0C`  
**Platforms:** All  
**Description:** Component mounted

##### On Disappear Event

**Type:** `ON_DISAPPEAR`  
**Binary Type ID:** `0x0D`  
**Platforms:** All  
**Description:** Component unmounted

##### On Change Event

**Type:** `ON_CHANGE`  
**Binary Type ID:** `0x0E`  
**Platforms:** All  
**Description:** Property changed

### 2.2 Event Type Summary

For the **authoritative event type definitions**, see **[BINARY_PROTOCOL.md - Event Type Table](../BINARY_PROTOCOL.md#event-type-table)**.

| Event Type | Binary ID (hex) | Binary ID (decimal) | Description | Data Payload |
|------------|-----------------|---------------------|-------------|--------------|
| TAP | 0x01 | 1 | Single tap/click | x, y, tapCount |
| DOUBLE_TAP | 0x02 | 2 | Double tap/click | x, y, tapCount |
| LONG_PRESS | 0x03 | 3 | Long press | x, y, duration, pressure |
| CLICK | 0x04 | 4 | Mouse click | x, y, button, clickCount, modifiers |
| HOVER | 0x05 | 5 | Hover state change | isHovering, x, y |
| FOCUS | 0x06 | 6 | Focus state change | isFocused |
| BLUR | 0x07 | 7 | Blur (focus lost) | isFocused |
| KEY_DOWN | 0x08 | 8 | Key pressed | keyCode, modifiers, repeat |
| KEY_UP | 0x09 | 9 | Key released | keyCode, modifiers |
| SCROLL | 0x0A | 10 | Scroll action | deltaX, deltaY, offsetX, offsetY |
| SWIPE | 0x0B | 11 | Swipe gesture | direction, velocity, distance |
| ON_APPEAR | 0x0C | 12 | Component mounted | None |
| ON_DISAPPEAR | 0x0D | 13 | Component unmounted | None |
| ON_CHANGE | 0x0E | 14 | Property changed | propertyId, valueType, value |

---

## 3. Event Propagation

### 3.1 Propagation Phases

#### 3.1.1 Capture Phase

- Event travels from the root down to the target component
- Handlers registered for the capture phase are invoked
- Capture phase is optional and implementation-defined

#### 3.1.2 Target Phase

- Event reaches the target component
- All handlers on the target component are invoked
- This is where most event handling occurs

#### 3.1.3 Bubble Phase

- Event travels from the target component back up to the root
- Handlers on each ancestor component are invoked
- This allows parent components to respond to events from their children

### 3.2 Propagation Control

Event handlers receive an event object that provides methods to control propagation:

**Note:** The JSON structure below is illustrative only.

```json
{
  "type": "tap",
  "timestamp": 1234567890,
  "target": "button",
  "path": ["root", "container", "button"],
  "data": { ... },
  "propagation": {
    "stopPropagation": <function>,
    "stopImmediatePropagation": <function>,
    "preventDefault": <function>
  }
}
```

**Methods:**

| Method | Description | Effect |
|--------|-------------|--------|
| `stopPropagation()` | Stops the event from propagating further | No further handlers in capture or bubble phases are called |
| `stopImmediatePropagation()` | Stops other handlers on the same component | No other handlers on the current component are called, and propagation stops |
| `preventDefault()` | Prevents the default action | The platform's default behavior for this event is prevented |

### 3.3 Event Path

The `path` field in the event object contains an array of component IDs from the root to the target component:

```json
{
  "path": ["root", "vstack-1", "hstack-2", "button-3"]
}
```

This path can be used for:
- Debugging
- Implementing custom propagation logic
- Determining the relationship between components

---

## 4. Binary Event Encoding (Authoritative)

For efficient transport, Pathland supports a **binary encoding** for events that matches the command protocol format.

> **IMPORTANT**: This section describes the **authoritative binary format**. For complete details, see **[BINARY_PROTOCOL.md - Event System](../BINARY_PROTOCOL.md#event-system)**.

### 4.1 Event Message Format

Events are dispatched using the `DISPATCH_EVENT` (0x07) opcode with the following binary format:

```
[u8 opcode=0x07][u32 targetId][u8 eventType][u32 timestamp][u8 phase][event-specific data...]
```

**Fields:**
- `opcode`: Always 0x07 for DISPATCH_EVENT
- `targetId`: The component ID that the event targets (u32, little-endian)
- `eventType`: The type of event (see Event Type IDs below, u8)
- `timestamp`: Milliseconds since epoch (u32, little-endian)
- `phase`: Event propagation phase (0x00=capture, 0x01=target, 0x02=bubble)

### 4.2 Event Type IDs

| Event Type | ID (hex) | ID (decimal) | Data Payload |
|------------|----------|--------------|--------------|
| TAP | 0x01 | 1 | `[f32 x][f32 y][u8 tapCount]` |
| DOUBLE_TAP | 0x02 | 2 | `[f32 x][f32 y][u8 tapCount]` |
| LONG_PRESS | 0x03 | 3 | `[f32 x][f32 y][f32 duration][f32 pressure]` |
| CLICK | 0x04 | 4 | `[f32 x][f32 y][u8 button][u8 clickCount][u8 modifiers]` |
| HOVER | 0x05 | 5 | `[u8 isHovering][f32 x][f32 y]` |
| FOCUS | 0x06 | 6 | `[u8 isFocused]` |
| BLUR | 0x07 | 7 | `[u8 isFocused]` |
| KEY_DOWN | 0x08 | 8 | `[u16 keyCode][u8 modifiers][u8 repeat]` |
| KEY_UP | 0x09 | 9 | `[u16 keyCode][u8 modifiers]` |
| SCROLL | 0x0A | 10 | `[f32 deltaX][f32 deltaY][f32 contentOffsetX][f32 contentOffsetY]` |
| SWIPE | 0x0B | 11 | `[u8 direction][f32 velocity][f32 distance]` |
| ON_APPEAR | 0x0C | 12 | (none) |
| ON_DISAPPEAR | 0x0D | 13 | (none) |
| ON_CHANGE | 0x0E | 14 | `[u16 propertyId][u8 valueType][value...]` |

### 4.3 Phase Enum

| Phase | Value | Description |
|-------|-------|-------------|
| CAPTURE | 0x00 | Event traveling from root to target |
| TARGET | 0x01 | Event at target component |
| BUBBLE | 0x02 | Event traveling from target to root |

### 4.4 Event Registration

Event handlers are registered using the `REGISTER_EVENT_HANDLER` (0x08) opcode:

```
[u8 opcode=0x08][u32 nodeId][u8 eventType][u8 handlerPhase][u32 handlerId]
```

**Fields:**
- `opcode`: Always 0x08 for REGISTER_EVENT_HANDLER
- `nodeId`: The component ID to register the handler on (u32, little-endian)
- `eventType`: The type of event to handle (u8, from Event Type IDs above)
- `handlerPhase`: Which propagation phase to handle (u8)
- `handlerId`: A unique identifier for the handler (u32, little-endian)

**Handler Phase Values:**
- `0x00`: Capture phase only
- `0x01`: Target phase only
- `0x02`: Bubble phase only
- `0xFF`: All phases

### 4.5 Binary Payload Details

#### TAP / DOUBLE_TAP Events

```
[f32 x][f32 y][u8 tapCount]
```

#### LONG_PRESS Event

```
[f32 x][f32 y][f32 duration][f32 pressure]
```

#### CLICK Event

```
[f32 x][f32 y][u8 button][u8 clickCount][u8 modifiers]
```

**Button Enum:**
- `0x00` = LEFT
- `0x01` = RIGHT
- `0x02` = MIDDLE
- `0x03` = BACK
- `0x04` = FORWARD

**Modifier Flags (u8):**
- Bit 0 (0x01): Shift key
- Bit 1 (0x02): Control key
- Bit 2 (0x04): Alt key
- Bit 3 (0x08): Meta key (Command/Windows)

#### HOVER Event

```
[u8 isHovering][f32 x][f32 y]
```

- `isHovering`: `0x00`=false, `0x01`=true

#### FOCUS / BLUR Events

```
[u8 isFocused]
```

- `isFocused`: `0x00`=false, `0x01`=true

#### KEY_DOWN Event

```
[u16 keyCode][u8 modifiers][u8 repeat]
```

- `repeat`: `0x00`=false, `0x01`=true

#### KEY_UP Event

```
[u16 keyCode][u8 modifiers]
```

#### SCROLL Event

```
[f32 deltaX][f32 deltaY][f32 contentOffsetX][f32 contentOffsetY]
```

#### SWIPE Event

```
[u8 direction][f32 velocity][f32 distance]
```

**Direction Enum:**
- `0x00` = LEFT
- `0x01` = RIGHT
- `0x02` = UP
- `0x03` = DOWN

#### ON_APPEAR / ON_DISAPPEAR Events

No data payload.

#### ON_CHANGE Event

```
[u16 propertyId][u8 valueType][value...]
```

The value is encoded using the same format as the `SET_PROPERTY` instruction (see **[BINARY_PROTOCOL.md - Value Type Table](../BINARY_PROTOCOL.md#value-type-table)**).

### 4.6 Usage Examples

**Registering a tap handler:**
```binary
08 2A 00 00 00 01 01 05 00 00 00
```
- Opcode: 0x08 (REGISTER_EVENT_HANDLER)
- nodeId: 42
- eventType: 0x01 (TAP)
- handlerPhase: 0x01 (TARGET)
- handlerId: 5

**Dispatching a tap event:**
```binary
07 2A 00 00 00 01 60 6E 9A 01 01 00 00 80 3F 00 00 00 00
```
- Opcode: 0x07 (DISPATCH_EVENT)
- targetId: 42
- eventType: 0x01 (TAP)
- timestamp: 1699911200 (example)
- phase: 0x01 (TARGET)
- data: x=1.0, y=0.0, tapCount=1

**Dispatching an onChange event:**
```binary
07 2A 00 00 00 0E 60 6E 9A 01 01 0A 00 07 02 FF 00 00 FF
```
- Opcode: 0x07 (DISPATCH_EVENT)
- targetId: 42
- eventType: 0x0E (ON_CHANGE)
- timestamp: 1699911200
- phase: 0x01 (TARGET)
- data: propertyId=0x000A (COLOR), valueType=0x07 (COLOR), colorKind=0x02 (LITERAL_SRGB), rgba=0xFF0000FF (blue)

---

## 5. Gesture System

> **IMPORTANT**: The JSON representations below are **illustrative only**. For the authoritative gesture system, see **[BINARY_PROTOCOL.md - Gesture System](../BINARY_PROTOCOL.md#gesture-system)**.

Pathland provides a **gesture system** inspired by SwiftUI that offers a more declarative and composable approach to handling user interactions compared to traditional event systems.

### 5.1 Overview

**Key Differences from Events:**

| Aspect | Events | Gestures |
|--------|--------|----------|
| **Model** | Discrete notifications | Stateful interactions |
| **Lifecycle** | Single dispatch | began → changed → ended/cancelled |
| **Composition** | Independent | Combinable (simultaneous, sequenced, exclusive) |
| **Use Case** | Simple interactions | Complex, continuous interactions |

**Example Gestures:**
- **Tap**: Single touch/click
- **Long Press**: Press and hold
- **Drag**: Move/panning
- **Swipe**: Quick directional movement
- **Pinch**: Two-finger zoom
- **Rotate**: Two-finger rotation

### 5.2 Gesture Types

For the **authoritative gesture type definitions**, see **[BINARY_PROTOCOL.md - Gesture Type Table](../BINARY_PROTOCOL.md#gesture-type-table)**.

| Gesture | Binary ID (hex) | Description | States | Platforms |
|---------|-----------------|-------------|--------|-----------|
| TAP | 0x10 | Single tap/click | began, ended | All |
| LONG_PRESS | 0x11 | Press and hold | began, changed, ended, cancelled | All |
| DRAG | 0x12 | Move/panning | began, changed, ended, cancelled | All |
| SWIPE | 0x13 | Quick directional swipe | began, changed, ended, cancelled | Touch, Mouse |
| PINCH | 0x14 | Two-finger zoom | began, changed, ended, cancelled | Touch, Mouse |
| ROTATE | 0x15 | Two-finger rotation | began, changed, ended, cancelled | Touch, Mouse |

### 5.3 Gesture States

All gestures progress through a lifecycle:

1. **BEGAN** (0x00): Gesture recognition has started
2. **CHANGED** (0x01): Gesture is actively changing (continuous updates)
3. **ENDED** (0x02): Gesture completed successfully
4. **CANCELLED** (0x03): Gesture was interrupted

### 5.4 Gesture Opcodes

For the **authoritative gesture opcodes**, see **[BINARY_PROTOCOL.md - Gesture Binary Encoding](../BINARY_PROTOCOL.md#gesture-binary-encoding)**.

| Opcode | Value | Description |
|--------|-------|-------------|
| GESTURE_UPDATE | 0x09 | Dispatch a gesture state update |
| ATTACH_GESTURE | 0x0A | Attach a gesture recognizer to a component |
| COMBINE_GESTURES | 0x0B | Combine two gestures |

### 5.5 Gesture Binary Encoding

#### Opcode: GESTURE_UPDATE (0x09)

```
[u8 opcode=0x09][u32 targetId][u8 gestureType][u8 gestureState][u32 timestamp][u32 gestureId][gesture-specific data...]
```

**Fields:**
- `targetId`: The component ID receiving the gesture (u32, little-endian)
- `gestureType`: Type of gesture (0x10-0x15, u8)
- `gestureState`: Current state of the gesture (0x00-0x03, u8)
- `timestamp`: Milliseconds since epoch (u32, little-endian)
- `gestureId`: Unique identifier for this gesture instance (u32, little-endian)

#### Opcode: ATTACH_GESTURE (0x0A)

```
[u8 opcode=0x0A][u32 nodeId][u8 gestureType][u32 gestureRecognizerId][u8 handlerPhase][u32 onBeganHandler][u32 onChangedHandler][u32 onEndedHandler][u32 onCancelledHandler]
```

**Fields:**
- `nodeId`: The component ID to attach gesture to (u32, little-endian)
- `gestureType`: Type of gesture (0x10-0x15, u8)
- `gestureRecognizerId`: Unique ID for this gesture recognizer (u32, little-endian)
- `handlerPhase`: Event phase (0x00=capture, 0x01=target, 0x02=bubble, 0xFF=any)
- `onBeganHandler`, `onChangedHandler`, `onEndedHandler`, `onCancelledHandler`: Handler IDs (u32, 0 = no handler)

#### Opcode: COMBINE_GESTURES (0x0B)

```
[u8 opcode=0x0B][u8 combinationType][u32 firstGestureId][u32 secondGestureId][u32 combinedGestureId]
```

**Combination Types:**
- `0x00` = SIMULTANEOUS (both gestures must succeed simultaneously)
- `0x01` = SEQUENCED (first gesture must fail for second to start)
- `0x02` = EXCLUSIVE (first gesture to start wins, others are cancelled)

### 5.6 Gesture vs Event: When to Use Which

| Scenario | Recommended Approach |
|----------|---------------------|
| Simple button tap | Event (`onTap`) |
| Single click action | Event (`onClick`) |
| Dragging an item | Gesture (`drag`) |
| Pinch-to-zoom | Gesture (`pinch`) |
| Image rotation | Gesture (`rotate`) |
| Swipe to delete | Gesture (`swipe`) |
| Long press for context menu | Gesture (`longPress`) |
| Combined pinch+rotate | Combined Gesture |
| Reactive state changes | Event (`onChange`) |
| Component lifecycle | Event (`onAppear`, `onDisappear`) |

---

## 6. Event Handling in Different Platforms

### 6.1 Touch Platforms (Mobile, Tablet)

- Primary events: `tap`, `doubleTap`, `longPress`, `swipe`
- Secondary events: `focus`, `blur`, `keyDown`, `keyUp` (for on-screen keyboards)
- Scroll events: `scroll` (for scrollable areas)

**Touch-Specific Considerations:**
- `tap` events should have a reasonable tap target size (recommended minimum 44x44 points)
- `longPress` should be triggered after a platform-specific delay (typically 500ms)
- `swipe` should be detected based on velocity and distance thresholds

### 6.2 Desktop Platforms (Mouse/Keyboard)

- Primary events: `click`, `hover`, `keyDown`, `keyUp`
- Secondary events: `doubleTap` (double click), `focus`, `blur`, `scroll`

**Desktop-Specific Considerations:**
- `hover` events should be efficient (not too many events for mouse movement)
- `click` events should include button information
- Keyboard events should support all standard keys

### 6.3 Web Platforms

- All core events should be supported
- Events should map to standard DOM events where appropriate
- Considerations for accessibility (keyboard navigation, screen readers)

### 6.4 Embedded Platforms

- Limited event support based on input capabilities
- May only support a subset of events (e.g., `tap` for touchscreens)
- Events may be simplified or combined

---

## 7. Event Coalescing

Implementations MAY coalesce multiple rapid events into a single event for performance:

- Multiple `scroll` events can be coalesced during rapid scrolling
- Multiple `tap` events can be coalesced during rapid tapping
- The exact coalescing strategy is implementation-defined

When coalescing events:
- The `timestamp` should reflect the time of the last event in the sequence
- The `data` should reflect the cumulative effect of all coalesced events
- Implementations SHOULD provide a way to disable coalescing for specific use cases

---

## 8. Event Timing

### 8.1 Timestamps

All events include a `timestamp` field that represents the time when the event occurred:

- **Unit:** Milliseconds since epoch (Unix timestamp)
- **Precision:** Implementation-defined, but SHOULD be at least millisecond precision
- **Synchronization:** Timestamps from different input sources MAY not be perfectly synchronized

### 8.2 Event Ordering

Events SHOULD be delivered in the order they occurred, but:
- Events from different input sources may be interleaved
- Rapid events may be coalesced (see Section 7)
- The exact ordering of simultaneous events is implementation-defined

---

## 9. Accessibility Considerations

### 9.1 Keyboard Accessibility

- All interactive components SHOULD be keyboard accessible
- `focus` and `blur` events should work with keyboard navigation
- `keyDown` and `keyUp` events should support all accessibility keys

### 9.2 Screen Reader Support

- Events should be compatible with screen reader announcements
- Implementations SHOULD provide a way to trigger screen reader announcements
- Custom events MAY be used for accessibility-specific interactions

### 9.3 Alternative Input Methods

- Events should work with alternative input methods (switch controls, eye tracking, etc.)
- Implementations SHOULD map alternative inputs to appropriate Pathland events

---

## 10. Security Considerations

### 10.1 Event Validation

Implementations SHOULD validate event data:
- Check that `targetId` exists in the component tree
- Check that event data fields have valid values
- Handle malformed or malicious event data gracefully

### 10.2 Event Rate Limiting

Implementations SHOULD protect against event flooding:
- Limit the rate of events from a single source
- Provide a way to throttle or debounce event handlers
- Handle malformed or malicious event data gracefully

### 10.3 Sensitive Data

Event data MAY contain sensitive information (e.g., key presses in password fields). Implementations SHOULD:
- Not log sensitive event data
- Provide a way to mask or filter sensitive events
- Respect platform security policies

---

## 11. Performance Considerations

### 11.1 Event Handling Performance

- Event handlers should be efficient (not block the main thread)
- Implementations SHOULD provide a way to batch or defer event handling
- Consider using event delegation for large component trees

### 11.2 Memory Usage

- Event objects should be lightweight
- Implementations SHOULD reuse or pool event objects where possible
- Large event data (e.g., images in custom events) should be handled carefully

### 11.3 Event Throttling

- Implementations MAY throttle high-frequency events (e.g., `scroll`, `hover`)
- Throttling strategy is implementation-defined
- Should provide a way to disable throttling for specific handlers

---

## 12. Testing Events

### 12.1 Event Simulation

Implementations SHOULD provide a way to simulate events for testing:
- Programmatic event creation and dispatch
- Event injection at any point in the component tree
- Control over event timing and ordering

### 12.2 Event Inspection

Implementations SHOULD provide a way to inspect events for debugging:
- Event logging
- Event breakpoints
- Event history

---

## Appendix A: Event Type Summary

For the **authoritative event type definitions**, see **[BINARY_PROTOCOL.md - Event Type Table](../BINARY_PROTOCOL.md#event-type-table)**.

| Event Type | Binary ID (hex) | Handler Name | Data Fields |
|------------|-----------------|--------------|-------------|
| TAP | 0x01 | `onTap` | x, y, tapCount |
| DOUBLE_TAP | 0x02 | `onDoubleTap` | x, y, tapCount |
| LONG_PRESS | 0x03 | `onLongPress` | x, y, duration, pressure |
| CLICK | 0x04 | `onClick` | x, y, button, clickCount, modifiers |
| HOVER | 0x05 | `onHover` | isHovering, x, y |
| FOCUS | 0x06 | `onFocus` | isFocused |
| BLUR | 0x07 | `onBlur` | isFocused |
| KEY_DOWN | 0x08 | `onKeyDown` | keyCode, modifiers, repeat |
| KEY_UP | 0x09 | `onKeyUp` | keyCode, modifiers |
| SCROLL | 0x0A | `onScroll` | deltaX, deltaY, offsetX, offsetY |
| SWIPE | 0x0B | `onSwipe` | direction, velocity, distance |
| ON_APPEAR | 0x0C | `onAppear` | None |
| ON_DISAPPEAR | 0x0D | `onDisappear` | None |
| ON_CHANGE | 0x0E | `onChange` | propertyId, oldValue, newValue |

---

## Appendix B: Quick Reference

For complete and authoritative protocol details, always refer to:

- **[BINARY_PROTOCOL.md](../BINARY_PROTOCOL.md)** - The official protocol specification
- **[Event Type Table](../BINARY_PROTOCOL.md#event-type-table)** - Complete event type definitions
- **[Gesture Type Table](../BINARY_PROTOCOL.md#gesture-type-table)** - Complete gesture type definitions
- **[Event System Section](../BINARY_PROTOCOL.md#event-system)** - Complete event system specifications
- **[Gesture Binary Encoding](../BINARY_PROTOCOL.md#gesture-binary-encoding)** - Gesture instruction formats

---

**Note**: This document is a **human-readable guide** to Pathland events. The binary protocol specification (BINARY_PROTOCOL.md) is the only authoritative source for protocol implementation. All numeric IDs, encodings, and behavior defined in this document must match BINARY_PROTOCOL.md exactly.