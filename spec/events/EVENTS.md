# Pathland Event System Specification

This document provides detailed specifications for the Pathland event system.

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

## 2. Event Types

### 2.1 Core Event Types

Pathland defines the following core event types that MUST be supported by all conforming implementations:

#### 2.1.1 Pointer Events

##### Tap Event

**Type:** `"tap"`  
**Platforms:** Touch, Mouse  
**Description:** A single tap/click action

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

**Fields:**
- `location`: The coordinate where the tap occurred, relative to the target component
- `tapCount`: Number of consecutive taps (1 for single tap, 2 for double tap, etc.)

**Usage:**
```json
{
  "type": "text",
  "content": "Tap me",
  "events": {
    "onTap": "handleTap"
  }
}
```

##### Double Tap Event

**Type:** `"doubleTap"`  
**Platforms:** Touch, Mouse  
**Description:** A double tap/click action (two taps in quick succession)

```json
{
  "type": "doubleTap",
  "timestamp": <number>,
  "target": <string>,
  "path": [<string>],
  "data": {
    "location": <Point>,
    "tapCount": 2
  }
}
```

**Note:** Implementations MAY automatically generate `doubleTap` events when two `tap` events occur within a platform-specific time threshold.

##### Long Press Event

**Type:** `"longPress"`  
**Platforms:** Touch  
**Description:** A sustained press that exceeds a platform-specific duration threshold

```json
{
  "type": "longPress",
  "timestamp": <number>,
  "target": <string>,
  "path": [<string>],
  "data": {
    "location": <Point>,
    "duration": <number>,
    "pressure": <number>
  }
}
```

**Fields:**
- `location`: The coordinate where the long press started
- `duration`: Duration of the press in milliseconds
- `pressure`: Pressure level (0.0 to 1.0) if supported by the platform

##### Click Event

**Type:** `"click"`  
**Platforms:** Mouse, Trackpad  
**Description:** A mouse click with button information

```json
{
  "type": "click",
  "timestamp": <number>,
  "target": <string>,
  "path": [<string>],
  "data": {
    "location": <Point>,
    "button": "left" | "right" | "middle" | "back" | "forward",
    "clickCount": <number>,
    "modifiers": <EventModifiers>
  }
}
```

**Fields:**
- `location`: The coordinate where the click occurred
- `button`: Which mouse button was pressed
- `clickCount`: Number of consecutive clicks
- `modifiers`: Keyboard modifiers that were active during the click

**Mouse Button Values:**
- `"left"`: Left mouse button (primary)
- `"right"`: Right mouse button (secondary)
- `"middle"`: Middle mouse button (wheel)
- `"back"`: Back button (navigation)
- `"forward"`: Forward button (navigation)

##### Hover Event

**Type:** `"hover"`  
**Platforms:** Mouse, Trackpad, Stylus  
**Description:** Mouse pointer enters or leaves a component

```json
{
  "type": "hover",
  "timestamp": <number>,
  "target": <string>,
  "path": [<string>],
  "data": {
    "isHovering": <boolean>,
    "location": <Point>
  }
}
```

**Fields:**
- `isHovering`: `true` when pointer enters, `false` when pointer leaves
- `location`: The coordinate where the hover state changed

**Behavior:**
- `isHovering: true` is sent when the pointer enters the component's bounds
- `isHovering: false` is sent when the pointer leaves the component's bounds

#### 2.1.2 Focus Events

##### Focus Event

**Type:** `"focus"`  
**Platforms:** All  
**Description:** A component gains focus

```json
{
  "type": "focus",
  "timestamp": <number>,
  "target": <string>,
  "path": [<string>],
  "data": {
    "isFocused": true
  }
}
```

##### Blur Event

**Type:** `"blur"`  
**Platforms:** All  
**Description:** A component loses focus

```json
{
  "type": "blur",
  "timestamp": <number>,
  "target": <string>,
  "path": [<string>],
  "data": {
    "isFocused": false
  }
}
```

**Focus Behavior:**
- Focus can be gained via keyboard navigation, mouse click, or programmatic focus
- Only one component can have focus at a time within a focus scope
- Focusable components are implementation-defined but SHOULD include interactive elements

#### 2.1.3 Keyboard Events

##### Key Down Event

**Type:** `"keyDown"`  
**Platforms:** All  
**Description:** A key is pressed down

```json
{
  "type": "keyDown",
  "timestamp": <number>,
  "target": <string>,
  "path": [<string>],
  "data": {
    "key": <string>,
    "code": <string>,
    "modifiers": <EventModifiers>,
    "repeat": <boolean>
  }
}
```

**Fields:**
- `key`: The character value of the key (e.g., `"a"`, `"Enter"`, `" "`)
- `code`: The physical key code (e.g., `"KeyA"`, `"Enter"`, `"Space"`)
- `modifiers`: Keyboard modifiers active during the key press
- `repeat`: `true` if this is a repeated key press (key held down)

##### Key Up Event

**Type:** `"keyUp"`  
**Platforms:** All  
**Description:** A key is released

```json
{
  "type": "keyUp",
  "timestamp": <number>,
  "target": <string>,
  "path": [<string>],
  "data": {
    "key": <string>,
    "code": <string>,
    "modifiers": <EventModifiers>
  }
}
```

**Key Values:**
Implementations SHOULD use standard key value names where possible:
- Alphanumeric: `"a"`, `"b"`, ..., `"0"`, `"1"`, ...
- Special: `" "` (space), `"Enter"`, `"Tab"`, `"Escape"`, `"Backspace"`, `"Delete"`
- Navigation: `"ArrowUp"`, `"ArrowDown"`, `"ArrowLeft"`, `"ArrowRight"`
- Function: `"F1"`, `"F2"`, ..., `"F12"`
- Modifiers: `"Shift"`, `"Control"`, `"Alt"`, `"Meta"`

**Code Values:**
Implementations SHOULD use standard key code names:
- `"KeyA"`, `"KeyB"`, ..., `"Digit0"`, `"Digit1"`, ...
- `"Enter"`, `"Tab"`, `"Space"`, `"Escape"`
- `"ArrowUp"`, `"ArrowDown"`, `"ArrowLeft"`, `"ArrowRight"`

#### 2.1.4 Scroll Events

##### Scroll Event

**Type:** `"scroll"`  
**Platforms:** Mouse wheel, Touchpad, Touch screen  
**Description:** A scroll action occurs

```json
{
  "type": "scroll",
  "timestamp": <number>,
  "target": <string>,
  "path": [<string>],
  "data": {
    "delta": {
      "x": <number>,
      "y": <number>
    },
    "contentOffset": {
      "x": <number>,
      "y": <number>
    },
    "contentSize": {
      "width": <number>,
      "height": <number>
    },
    "viewportSize": {
      "width": <number>,
      "height": <number>
    }
  }
}
```

**Fields:**
- `delta`: The scroll delta in pixels (negative for up/left, positive for down/right)
- `contentOffset`: Current scroll offset of the scrollable content
- `contentSize`: Total size of the scrollable content
- `viewportSize`: Size of the visible viewport

#### 2.1.5 Gesture Events

##### Swipe Event

**Type:** `"swipe"`  
**Platforms:** Touch  
**Description:** A swipe gesture is detected

```json
{
  "type": "swipe",
  "timestamp": <number>,
  "target": <string>,
  "path": [<string>],
  "data": {
    "direction": "left" | "right" | "up" | "down",
    "velocity": <number>,
    "distance": <number>
  }
}
```

**Fields:**
- `direction`: The primary direction of the swipe
- `velocity`: The velocity of the swipe in pixels per second
- `distance`: The total distance of the swipe in pixels

**Detection:**
- Implementations SHOULD detect swipes based on platform-specific heuristics
- A swipe is typically a quick, straight-line gesture
- The direction is determined by the primary axis of movement

### 2.2 Event Modifiers

`EventModifiers` is a common structure used in pointer and keyboard events:

```json
{
  "shift": <boolean>,
  "control": <boolean>,
  "alt": <boolean>,
  "meta": <boolean>
}
```

**Modifier Keys:**
- `shift`: Shift key is pressed
- `control`: Control key is pressed (Ctrl on Windows/Linux, Control on macOS)
- `alt`: Alt key is pressed (Option on macOS)
- `meta`: Meta key is pressed (Windows key on Windows, Command on macOS)

### 2.3 Custom Events

Implementations MAY define custom event types. Custom events:

1. MUST have a unique type name that doesn't conflict with core types
2. SHOULD follow the same structure as core events
3. SHOULD be documented
4. MAY be ignored by renderers that don't support them

**Custom Event Structure:**

```json
{
  "type": <string>,  // Custom type name
  "timestamp": <number>,
  "target": <string>,
  "path": [<string>],
  "data": { ... }  // Custom data structure
}
```

**Example Custom Event:**

```json
{
  "type": "pinch",
  "timestamp": 1234567890,
  "target": "image-viewer",
  "path": ["root", "image-viewer"],
  "data": {
    "scale": 1.5,
    "center": {"x": 100, "y": 150}
  }
}
```

## 3. Event Handlers

### 3.1 Handler Registration

Event handlers are registered in the component's `events` object:

```json
{
  "type": "text",
  "content": "Click me",
  "events": {
    "onTap": <EventHandlerReference>,
    "onClick": <EventHandlerReference>,
    "onDoubleTap": <EventHandlerReference>,
    "onLongPress": <EventHandlerReference>,
    "onHover": <EventHandlerReference>,
    "onFocus": <EventHandlerReference>,
    "onBlur": <EventHandlerReference>,
    "onKeyDown": <EventHandlerReference>,
    "onKeyUp": <EventHandlerReference>,
    "onScroll": <EventHandlerReference>,
    "onSwipe": <EventHandlerReference>
  }
}
```

### 3.2 Handler Naming Convention

Event handler names follow the pattern `on<EventType>` where `<EventType>` is the capitalized event type:

| Event Type | Handler Name |
|------------|--------------|
| `tap` | `onTap` |
| `doubleTap` | `onDoubleTap` |
| `longPress` | `onLongPress` |
| `click` | `onClick` |
| `hover` | `onHover` |
| `focus` | `onFocus` |
| `blur` | `onBlur` |
| `keyDown` | `onKeyDown` |
| `keyUp` | `onKeyUp` |
| `scroll` | `onScroll` |
| `swipe` | `onSwipe` |
| `onAppear` | `onAppear` |
| `onDisappear` | `onDisappear` |
| `onChange` | `onChange` |

### 3.3 Handler Representation

The representation of an `EventHandlerReference` is implementation-defined. It can be:

- A string identifier (e.g., `"handleTap"`)
- A function reference (in languages that support it)
- A callback object
- Any other language-appropriate representation

**Important:** The protocol does not specify how event handlers are represented, only that they can be invoked when the corresponding event occurs.

### 3.4 Handler Invocation

When an event occurs:

1. The renderer identifies the target component
2. The renderer builds the event path (from root to target)
3. The renderer creates the event object
4. The renderer invokes the appropriate handler on the target component
5. If the handler doesn't call `stopPropagation()`, the event bubbles up the tree

### 3.5 Multiple Handlers

Multiple handlers can be registered for the same event on the same component. They are invoked in the order they were registered, unless `stopImmediatePropagation()` is called.

## 4. Event Propagation

### 4.1 Propagation Phases

#### 4.1.1 Capture Phase

- Event travels from the root down to the target component
- Handlers registered for the capture phase are invoked
- Capture phase is optional and implementation-defined
- To register a capture phase handler, implementations MAY use a naming convention like `onTapCapture`

#### 4.1.2 Target Phase

- Event reaches the target component
- All handlers on the target component are invoked
- This is where most event handling occurs

#### 4.1.3 Bubble Phase

- Event travels from the target component back up to the root
- Handlers on each ancestor component are invoked
- This allows parent components to respond to events from their children

### 4.2 Propagation Control

Event handlers receive an event object that provides methods to control propagation:

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

**Note:** The exact representation of these methods is implementation-defined.

### 4.3 Event Path

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

## 5. Event Handling in Different Platforms

### 5.1 Touch Platforms (Mobile, Tablet)

- Primary events: `tap`, `doubleTap`, `longPress`, `swipe`
- Secondary events: `focus`, `blur`, `keyDown`, `keyUp` (for on-screen keyboards)
- Scroll events: `scroll` (for scrollable areas)

**Touch-Specific Considerations:**
- `tap` events should have a reasonable tap target size (recommended minimum 44x44 points)
- `longPress` should be triggered after a platform-specific delay (typically 500ms)
- `swipe` should be detected based on velocity and distance thresholds

### 5.2 Desktop Platforms (Mouse/Keyboard)

- Primary events: `click`, `hover`, `keyDown`, `keyUp`
- Secondary events: `doubleTap` (double click), `focus`, `blur`, `scroll`

**Desktop-Specific Considerations:**
- `hover` events should be efficient (not too many events for mouse movement)
- `click` events should include button information
- Keyboard events should support all standard keys

### 5.3 Web Platforms

- All core events should be supported
- Events should map to standard DOM events where appropriate
- Considerations for accessibility (keyboard navigation, screen readers)

### 5.4 Embedded Platforms

- Limited event support based on input capabilities
- May only support a subset of events (e.g., `tap` for touchscreens)
- Events may be simplified or combined

## 6. Event Coalescing

Implementations MAY coalesce multiple rapid events into a single event for performance:

- Multiple `scroll` events can be coalesced during rapid scrolling
- Multiple `tap` events can be coalesced during rapid tapping
- The exact coalescing strategy is implementation-defined

When coalescing events:
- The `timestamp` should reflect the time of the last event in the sequence
- The `data` should reflect the cumulative effect of all coalesced events
- Implementations SHOULD provide a way to disable coalescing for specific use cases

## 7. Event Timing

### 7.1 Timestamps

All events include a `timestamp` field that represents the time when the event occurred:

- **Unit:** Milliseconds since epoch (Unix timestamp)
- **Precision:** Implementation-defined, but SHOULD be at least millisecond precision
- **Synchronization:** Timestamps from different input sources MAY not be perfectly synchronized

### 7.2 Event Ordering

Events SHOULD be delivered in the order they occurred, but:
- Events from different input sources may be interleaved
- Rapid events may be coalesced (see Section 6)
- The exact ordering of simultaneous events is implementation-defined

## 8. Accessibility Considerations

### 8.1 Keyboard Accessibility

- All interactive components SHOULD be keyboard accessible
- `focus` and `blur` events should work with keyboard navigation
- `keyDown` and `keyUp` events should support all accessibility keys

### 8.2 Screen Reader Support

- Events should be compatible with screen reader announcements
- Implementations SHOULD provide a way to trigger screen reader announcements
- Custom events MAY be used for accessibility-specific interactions

### 8.3 Alternative Input Methods

- Events should work with alternative input methods (switch controls, eye tracking, etc.)
- Implementations SHOULD map alternative inputs to appropriate Pathland events

## 9. Security Considerations

### 9.1 Event Validation

Implementations SHOULD validate event data:
- Check that `target` exists in the component tree
- Check that `path` is valid and leads to the `target`
- Check that event data fields have valid values

### 9.2 Event Rate Limiting

Implementations SHOULD protect against event flooding:
- Limit the rate of events from a single source
- Provide a way to throttle or debounce event handlers
- Handle malformed or malicious event data gracefully

### 9.3 Sensitive Data

Event data MAY contain sensitive information (e.g., key presses in password fields). Implementations SHOULD:
- Not log sensitive event data
- Provide a way to mask or filter sensitive events
- Respect platform security policies

## 10. Performance Considerations

### 10.1 Event Handling Performance

- Event handlers should be efficient (not block the main thread)
- Implementations SHOULD provide a way to batch or defer event handling
- Consider using event delegation for large component trees

### 10.2 Memory Usage

- Event objects should be lightweight
- Implementations SHOULD reuse or pool event objects where possible
- Large event data (e.g., images in custom events) should be handled carefully

### 10.3 Event Throttling

- Implementations MAY throttle high-frequency events (e.g., `scroll`, `hover`)
- Throttling strategy is implementation-defined
- Should provide a way to disable throttling for specific handlers

## 11. Testing Events

### 11.1 Event Simulation

Implementations SHOULD provide a way to simulate events for testing:
- Programmatic event creation and dispatch
- Event injection at any point in the component tree
- Control over event timing and ordering

### 11.2 Event Inspection

Implementations SHOULD provide a way to inspect events for debugging:
- Event logging
- Event breakpoints
- Event history

## Appendix A: Event Type Summary

| Event Type | Platforms | Handler Name | Data Fields |
|------------|-----------|--------------|-------------|
| `tap` | Touch, Mouse | `onTap` | `location`, `tapCount` |
| `doubleTap` | Touch, Mouse | `onDoubleTap` | `location`, `tapCount` |
| `longPress` | Touch | `onLongPress` | `location`, `duration`, `pressure` |
| `click` | Mouse | `onClick` | `location`, `button`, `clickCount`, `modifiers` |
| `hover` | Mouse | `onHover` | `isHovering`, `location` |
| `focus` | All | `onFocus` | `isFocused` |
| `blur` | All | `onBlur` | `isFocused` |
| `keyDown` | All | `onKeyDown` | `key`, `code`, `modifiers`, `repeat` |
| `keyUp` | All | `onKeyUp` | `key`, `code`, `modifiers` |
| `scroll` | All | `onScroll` | `delta`, `contentOffset`, `contentSize`, `viewportSize` |
| `swipe` | Touch | `onSwipe` | `direction`, `velocity`, `distance` |
| `onAppear` | All | `onAppear` | None |
| `onDisappear` | All | `onDisappear` | None |
| `onChange` | All | `onChange` | `propertyId`, `oldValue`, `newValue` |

---

## Binary Event Encoding

For efficient transport, Pathland supports a **binary encoding** for events that matches the command protocol format.

### Event Message Format

Events are dispatched using the `DISPATCH_EVENT` (0x07) opcode with the following binary format:

```
[u8 opcode=0x07][u32 targetId][u8 eventType][u32 timestamp][u8 phase][event-specific data...]
```

**Fields:**
- `opcode`: Always 0x07 for DISPATCH_EVENT
- `targetId`: The component ID that the event targets
- `eventType`: The type of event (see Event Type IDs below)
- `timestamp`: Milliseconds since epoch (little-endian)
- `phase`: Event propagation phase (0x00=capture, 0x01=target, 0x02=bubble)

### Event Type IDs

| Event Type | ID (hex) | ID (decimal) | Data Payload |
|------------|----------|--------------|--------------|
| TAP | 0x01 | 1 | x, y, tapCount |
| DOUBLE_TAP | 0x02 | 2 | x, y, tapCount |
| LONG_PRESS | 0x03 | 3 | x, y, duration, pressure |
| CLICK | 0x04 | 4 | x, y, button, clickCount, modifiers |
| HOVER | 0x05 | 5 | isHovering, x, y |
| FOCUS | 0x06 | 6 | isFocused |
| BLUR | 0x07 | 7 | isFocused |
| KEY_DOWN | 0x08 | 8 | keyCode, modifiers, repeat |
| KEY_UP | 0x09 | 9 | keyCode, modifiers |
| SCROLL | 0x0A | 10 | deltaX, deltaY, offsetX, offsetY |
| SWIPE | 0x0B | 11 | direction, velocity, distance |
| ON_APPEAR | 0x0C | 12 | (none) |
| ON_DISAPPEAR | 0x0D | 13 | (none) |
| ON_CHANGE | 0x0E | 14 | propertyId, valueType, value |

### Phase Enum

| Phase | Value | Description |
|-------|-------|-------------|
| CAPTURE | 0x00 | Event traveling from root to target |
| TARGET | 0x01 | Event at target component |
| BUBBLE | 0x02 | Event traveling from target to root |

### Event Registration

Event handlers are registered using the `REGISTER_EVENT_HANDLER` (0x08) opcode:

```
[u8 opcode=0x08][u32 nodeId][u8 eventType][u8 handlerPhase][u32 handlerId]
```

**Fields:**
- `opcode`: Always 0x08 for REGISTER_EVENT_HANDLER
- `nodeId`: The component ID to register the handler on
- `eventType`: The type of event to handle
- `handlerPhase`: Which propagation phase to handle (0x00=capture, 0x01=target, 0x02=bubble, 0xFF=any)
- `handlerId`: A unique identifier for the handler (used for callback invocation)

**Handler Phase Values:**
- 0x00: Capture phase only
- 0x01: Target phase only
- 0x02: Bubble phase only
- 0xFF: All phases

### Binary Payload Details

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
- Button: 0x00=LEFT, 0x01=RIGHT, 0x02=MIDDLE, 0x03=BACK, 0x04=FORWARD
- Modifiers: Bit flags (0x01=SHIFT, 0x02=CTRL, 0x04=ALT, 0x08=META)

#### HOVER Event
```
[u8 isHovering][f32 x][f32 y]
```
- isHovering: 0x00=false, 0x01=true

#### FOCUS / BLUR Events
```
[u8 isFocused]
```
- isFocused: 0x00=false, 0x01=true

#### KEY_DOWN Event
```
[u16 keyCode][u8 modifiers][u8 repeat]
```
- repeat: 0x00=false, 0x01=true

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
- Direction: 0x00=LEFT, 0x01=RIGHT, 0x02=UP, 0x03=DOWN

#### ON_APPEAR / ON_DISAPPEAR Events
No data payload.

#### ON_CHANGE Event
```
[u16 propertyId][u8 valueType][value...]
```
The value is encoded using the same format as the `SET_PROPERTY` instruction (see Value Type Table in the main protocol specification).

### Usage Examples

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

## Appendix B: Example Event Flow

```json
// Component tree
{
  "type": "vstack",
  "id": "root",
  "children": [
    {
      "type": "hstack",
      "id": "toolbar",
      "children": [
        {
          "type": "text",
          "id": "button",
          "content": "Click me",
          "events": {
            "onClick": "handleClick"
          }
        }
      ]
    }
  ]
}

// Click event
{
  "type": "click",
  "timestamp": 1234567890,
  "target": "button",
  "path": ["root", "toolbar", "button"],
  "data": {
    "location": {"x": 50, "y": 25},
    "button": "left",
    "clickCount": 1,
    "modifiers": {
      "shift": false,
      "control": false,
      "alt": false,
      "meta": false
    }
  }
}

// Propagation:
// 1. Capture phase (optional): root -> toolbar -> button
// 2. Target phase: button (handleClick is called)
// 3. Bubble phase: button -> toolbar -> root
```
