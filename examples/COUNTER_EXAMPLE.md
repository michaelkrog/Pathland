# Pathland Counter Example

**Version:** 2.0.0-alpha  
**Status:** Draft  
**Last Updated:** June 26, 2026

> **IMPORTANT**: This document provides a **conceptual** example of a counter application using Pathland. The JSON representation is **illustrative only** and does not reflect the actual binary protocol format. For the **authoritative protocol specification**, see **[BINARY_PROTOCOL.md](../spec/BINARY_PROTOCOL.md)**. The actual protocol uses binary encoding with numeric IDs for components, properties, and values.

This example demonstrates all the core concepts: HStack, VStack, Text components with gap, alignment, padding, border, background, and events.

---

## Complete Counter Application (Conceptual)

> **IMPORTANT**: The JSON below is a **human-readable conceptual representation** of the component tree. The actual protocol transmits **binary commands** (CREATE_NODE, SET_PROPERTY, INSERT_CHILD, etc.) using the format defined in BINARY_PROTOCOL.md.

```json
{
  "type": "vstack",
  "id": "counter-app",
  "modifiers": {
    "gap": 20,
    "alignment": "center",
    "padding": {"all": 30},
    "background": {
      "color": "#F5F5F7"
    }
  },
  "children": [
    {
      "type": "text",
      "id": "title",
      "content": "Pathland Counter",
      "modifiers": {
        "font": {
          "family": ["SF Pro", "Helvetica", "Arial", "sans-serif"],
          "size": 32,
          "weight": "bold"
        },
        "color": "#1D1D1F",
        "textAlignment": "center"
      }
    },
    {
      "type": "text",
      "id": "count-display",
      "content": "0",
      "modifiers": {
        "font": {
          "family": ["SF Pro", "Helvetica", "Arial", "sans-serif"],
          "size": 72,
          "weight": "bold"
        },
        "color": "#0071E3",
        "textAlignment": "center",
        "padding": {"horizontal": 40, "vertical": 20},
        "background": {
          "color": "#FFFFFF",
          "opacity": 1.0
        },
        "border": {
          "width": 4,
          "color": "#0071E3",
          "radius": 16,
          "style": "solid"
        }
      }
    },
    {
      "type": "hstack",
      "id": "button-row",
      "modifiers": {
        "gap": 16,
        "alignment": "center",
        "justification": "center"
      },
      "children": [
        {
          "type": "text",
          "id": "decrement-button",
          "content": "-",
          "modifiers": {
            "font": {
              "size": 24,
              "weight": "bold"
            },
            "color": "#FFFFFF",
            "textAlignment": "center",
            "padding": {"horizontal": 30, "vertical": 15},
            "background": {
              "color": "#FF3B30"
            },
            "border": {
              "width": 0,
              "radius": 12
            }
          },
          "events": {
            "onTap": "decrementCounter",
            "onClick": "decrementCounter"
          }
        },
        {
          "type": "text",
          "id": "reset-button",
          "content": "Reset",
          "modifiers": {
            "font": {
              "size": 18,
              "weight": "semibold"
            },
            "color": "#1D1D1F",
            "textAlignment": "center",
            "padding": {"horizontal": 25, "vertical": 15},
            "background": {
              "color": "#FFFFFF"
            },
            "border": {
              "width": 2,
              "color": "#D2D2D7",
              "radius": 12
            }
          },
          "events": {
            "onTap": "resetCounter",
            "onClick": "resetCounter"
          }
        },
        {
          "type": "text",
          "id": "increment-button",
          "content": "+",
          "modifiers": {
            "font": {
              "size": 24,
              "weight": "bold"
            },
            "color": "#FFFFFF",
            "textAlignment": "center",
            "padding": {"horizontal": 30, "vertical": 15},
            "background": {
              "color": "#34C759"
            },
            "border": {
              "width": 0,
              "radius": 12
            }
          },
          "events": {
            "onTap": "incrementCounter",
            "onClick": "incrementCounter"
          }
        }
      ]
    },
    {
      "type": "vstack",
      "id": "stats-section",
      "modifiers": {
        "gap": 8,
        "alignment": "center",
        "padding": {"horizontal": 20, "vertical": 15},
        "background": {
          "color": "#FFFFFF",
          "opacity": 0.8
        },
        "border": {
          "radius": 12
        }
      },
      "children": [
        {
          "type": "text",
          "id": "stats-title",
          "content": "Statistics",
          "modifiers": {
            "font": {
              "size": 16,
              "weight": "semibold"
            },
            "color": "#515154",
            "textAlignment": "center"
          }
        },
        {
          "type": "hstack",
          "id": "stats-row",
          "modifiers": {
            "gap": 20,
            "alignment": "center",
            "justification": "spaceBetween"
          },
          "children": [
            {
              "type": "text",
              "id": "total-increments",
              "content": "Increments: 0",
              "modifiers": {
                "font": {"size": 14},
                "color": "#515154"
              }
            },
            {
              "type": "text",
              "id": "total-decrements",
              "content": "Decrements: 0",
              "modifiers": {
                "font": {"size": 14},
                "color": "#515154"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Binary Protocol Equivalent

The conceptual JSON above would be transmitted as **binary commands** using the BINARY_PROTOCOL.md format. For example:

```
# Message 1: Create component tree (simplified)
# Header: version=1, instructionCount=10
01 00 0A 00 00 00

# CREATE_NODE: VSTACK (id=1, type=0x0002)
01 01 00 00 00 02 00 00

# CREATE_NODE: TEXT title (id=2, type=0x0003) with properties
01 02 00 00 00 03 00 04    # 4 properties
0A 00 05 11 00 00 00     # text="Pathland Counter" (17 chars)
50 61 74 68 6C 61 6E 64 20 43 6F 75 6E 74 65 72 00
10 0A 07 01 01 00        # color=PRIMARY_TEXT (SEMANTIC_TOKEN)
10 07 04 00 00 00 42    # fontSize=32.0
10 0C 06 01              # textAlignment=CENTER
... (additional commands for other nodes)
```

**For complete binary encoding details**, see **[BINARY_PROTOCOL.md](../spec/BINARY_PROTOCOL.md)**.

---

## State Management

The counter application uses the following state (application-level, not transmitted over protocol):

```json
{
  "signals": [
    {
      "id": "count",
      "name": "Counter Value",
      "value": 0,
      "version": 1,
      "computed": false
    },
    {
      "id": "total-increments",
      "name": "Total Increments",
      "value": 0,
      "version": 1,
      "computed": false
    },
    {
      "id": "total-decrements",
      "name": "Total Decrements",
      "value": 0,
      "version": 1,
      "computed": false
    }
  ]
}
```

**Note:** State management is **application-side only**. The protocol only transmits commands, not state.

---

## Event Handlers

The event handlers for the counter application:

```javascript
// Pseudo-code for event handlers
// These would be implemented in the host language

function incrementCounter(event) {
  // Get current count
  const currentCount = getSignalValue("count");
  
  // Update count
  setSignalValue("count", currentCount + 1);
  
  // Update statistics
  const currentIncrements = getSignalValue("total-increments");
  setSignalValue("total-increments", currentIncrements + 1);
  
  // Application generates SET_PROPERTY commands to update displays
  updateTextContent("count-display", (currentCount + 1).toString());
  updateTextContent("total-increments", "Increments: " + (currentIncrements + 1));
}

function decrementCounter(event) {
  // Get current count
  const currentCount = getSignalValue("count");
  
  // Update count (don't go below 0)
  const newCount = Math.max(0, currentCount - 1);
  setSignalValue("count", newCount);
  
  // Update statistics
  const currentDecrements = getSignalValue("total-decrements");
  setSignalValue("total-decrements", currentDecrements + 1);
  
  // Application generates SET_PROPERTY commands to update displays
  updateTextContent("count-display", newCount.toString());
  updateTextContent("total-decrements", "Decrements: " + (currentDecrements + 1));
}

function resetCounter(event) {
  // Reset all state
  setSignalValue("count", 0);
  setSignalValue("total-increments", 0);
  setSignalValue("total-decrements", 0);
  
  // Application generates SET_PROPERTY commands to update displays
  updateTextContent("count-display", "0");
  updateTextContent("total-increments", "Increments: 0");
  updateTextContent("total-decrements", "Decrements: 0");
}
```

**Note:** Event handlers are **application-side**. The protocol transmits events from renderer to application using DISPATCH_EVENT opcode (0x07).

---

## Component Breakdown

### Root VStack
- **Binary Type:** `0x0002` (VSTACK)
- **Binary Properties:**
  - `spacing` (0x0001) = 20.0 (F32)
  - `alignment` (0x0002) = CENTER (0x01)
  - `padding` (0x1006) = 30.0 (F32)
  - `backgroundColor` (0x1001) = LITERAL_SRGB 0xFFF5F5F7 (white-ish gray)

### Title Text
- **Binary Type:** `0x0003` (TEXT)
- **Binary Properties:**
  - `text` (0x000A) = "Pathland Counter" (STRING)
  - `fontSize` (0x1007) = 32.0 (F32)
  - `fontWeight` (0x1008) = BOLD (0x06)
  - `color` (0x100A) = LITERAL_SRGB 0xFF1D1D1F (dark gray)
  - `textAlignment` (0x000C) = CENTER (0x01)

### Count Display Text
- **Binary Type:** `0x0003` (TEXT)
- **Binary Properties:**
  - `text` (0x000A) = "0" (STRING, dynamic)
  - `fontSize` (0x1007) = 72.0 (F32)
  - `fontWeight` (0x1008) = BOLD (0x06)
  - `color` (0x100A) = LITERAL_SRGB 0xFF0071E3 (blue)
  - `textAlignment` (0x000C) = CENTER (0x01)
  - `padding` (0x1006) = 20.0 (F32 for vertical), 40.0 (F32 for horizontal)
  - `backgroundColor` (0x1001) = LITERAL_SRGB 0xFFFFFFFF (white)
  - `borderWidth` (0x1003) = 4.0 (F32)
  - `borderColor` (0x1004) = LITERAL_SRGB 0xFF0071E3 (blue)
  - `borderRadius` (0x1005) = 16.0 (F32)

### Button Row HStack
- **Binary Type:** `0x0001` (HSTACK)
- **Binary Properties:**
  - `spacing` (0x0001) = 16.0 (F32)
  - `alignment` (0x0002) = CENTER (0x01)
  - `justification` (0x0003) = CENTER (0x01)

### Buttons
All buttons are TEXT components with:
- Event handlers registered via REGISTER_EVENT_HANDLER (0x08)
- Different background colors, padding, and border radii

---

## Key Features Demonstrated

### Layout Features
1. **HStack with gap, alignment, justification** - Button row shows horizontal layout
2. **VStack with gap, alignment, padding** - Root and stats section show vertical layout
3. **Nested stacks** - HStack inside VStack for complex layouts

### Style Features
1. **Font styling** - Various font sizes, weights, and families
2. **Text alignment** - Center, leading, trailing
3. **Padding** - Different padding values for different components
4. **Background colors** - Solid colors with opacity
5. **Border styling** - Width, color, radius, and style

### Event Features
1. **Tap events** - For touch input (maps to TAP event type 0x01)
2. **Click events** - For mouse input (maps to CLICK event type 0x04)
3. **Event handlers** - Functions that update state and generate commands

### State Features
1. **Signals** - Reactive state management (application-side)
2. **State updates** - Modifying signal values (application-side)
3. **UI updates** - Generating commands based on state changes (application-side)

---

## Visual Representation

```
┌─────────────────────────────────────────┐
│  Pathland Counter                          │
│                                             │
│     ┌─────────────────────────────┐       │
│     │             0               │       │
│     │   (blue border, white bg)    │       │
│     └─────────────────────────────┘       │
│                                             │
│     ┌─────────┐   ┌─────────┐   ┌─────────┐ │
│     │    -    │   │  Reset  │   │    +    │ │
│     │ (red)   │   │ (white) │   │ (green) │ │
│     └─────────┘   └─────────┘   └─────────┘ │
│                                             │
│     ┌─────────────────────────────┐       │
│     │  Statistics                   │       │
│     │  Increments: 0   Decrements: 0│       │
│     │  (light gray bg, rounded)     │       │
│     └─────────────────────────────┘       │
│                                             │
└─────────────────────────────────────────┘
```

---

## Binary Protocol Mapping

The conceptual JSON in this example maps to the following binary protocol elements:

| Conceptual Property | Binary Property ID | Value Type | Notes |
|---------------------|--------------------|------------|-------|
| `type` | Component type in CREATE_NODE | u16 | HSTACK=0x0001, VSTACK=0x0002, TEXT=0x0003 |
| `gap` | 0x0001 | F32 | For HSTACK/VSTACK |
| `alignment` | 0x0002 | ENUM | For HSTACK/VSTACK |
| `justification` | 0x0003 | ENUM | For HSTACK/VSTACK |
| `padding` | 0x1006 | F32 or DESIGN_TOKEN | Style property |
| `background.color` | 0x1001 | COLOR | Style property |
| `border.width` | 0x1003 | F32 | Style property |
| `border.color` | 0x1004 | COLOR | Style property |
| `border.radius` | 0x1005 | F32 | Style property |
| `color` (text) | 0x100A | COLOR | Style property |
| `font.size` | 0x1007 | F32 | Style property |
| `font.weight` | 0x1008 | ENUM | Style property |
| `textAlignment` | 0x000C | ENUM | TEXT property |
| `content` | 0x000A | STRING | TEXT property |

**For complete property mapping**, see **[BINARY_PROTOCOL.md - Property ID Definitions](../spec/BINARY_PROTOCOL.md#property-id-definitions)**.

---

## Implementation Notes

### For Web Renderer
- Map `onTap` to `onclick` for touch devices
- Map `onClick` to `onclick` for mouse devices
- Use CSS for styling (padding, background, border, etc.)
- Use flexbox for HStack and VStack layout

### For Mobile Renderer
- Map `onTap` to touch events
- Use platform-specific styling APIs
- Use platform-specific layout systems

### For Embedded Renderer
- Map events to appropriate input handlers
- Use graphics library for rendering
- Implement layout engine for HStack/VStack

---

## Extensions

This example can be extended with:

1. **Animation** - Add smooth transitions when count changes
2. **Theming** - Support light/dark mode using design tokens
3. **Localization** - Support multiple languages
4. **Accessibility** - Add ARIA labels and keyboard support
5. **Persistence** - Save state to local storage

---

**Note**: This document is a **conceptual example**. For actual implementation, always refer to **[BINARY_PROTOCOL.md](../spec/BINARY_PROTOCOL.md)** for the authoritative protocol specification.