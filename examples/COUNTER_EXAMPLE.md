# Pathland Counter Example

This document provides a complete, working example of a counter application using the Pathland protocol. This example demonstrates all the core concepts: HStack, VStack, Text components with gap, alignment, padding, border, background, and events.

## Complete Counter Application

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
              "family": ["SF Pro", "Helvetica", "Arial", "sans-serif"],
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
              "family": ["SF Pro", "Helvetica", "Arial", "sans-serif"],
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
              "family": ["SF Pro", "Helvetica", "Arial", "sans-serif"],
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

## State Management

The counter application uses the following state:

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
  
  // Update display
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
  
  // Update display
  updateTextContent("count-display", newCount.toString());
  updateTextContent("total-decrements", "Decrements: " + (currentDecrements + 1));
}

function resetCounter(event) {
  // Reset all state
  setSignalValue("count", 0);
  setSignalValue("total-increments", 0);
  setSignalValue("total-decrements", 0);
  
  // Update displays
  updateTextContent("count-display", "0");
  updateTextContent("total-increments", "Increments: 0");
  updateTextContent("total-decrements", "Decrements: 0");
}
```

## Component Breakdown

### Root VStack
- **Type:** `vstack`
- **Modifiers:**
  - `gap: 20` - Vertical spacing between children
  - `alignment: "center"` - Children are centered horizontally
  - `padding: {all: 30}` - 30px padding on all sides
  - `background: {color: "#F5F5F7"}` - Light gray background

### Title Text
- **Type:** `text`
- **Content:** "Pathland Counter"
- **Modifiers:**
  - `font: {family: [...], size: 32, weight: "bold"}` - Large, bold font
  - `color: "#1D1D1F"` - Dark text color
  - `textAlignment: "center"` - Centered text

### Count Display Text
- **Type:** `text`
- **Content:** Dynamic (starts at "0")
- **Modifiers:**
  - `font: {size: 72, weight: "bold"}` - Very large, bold font
  - `color: "#0071E3"` - Blue text color
  - `padding: {horizontal: 40, vertical: 20}` - Generous padding
  - `background: {color: "#FFFFFF"}` - White background
  - `border: {width: 4, color: "#0071E3", radius: 16}` - Thick blue border with rounded corners

### Button Row HStack
- **Type:** `hstack`
- **Modifiers:**
  - `gap: 16` - Horizontal spacing between buttons
  - `alignment: "center"` - Buttons are centered vertically
  - `justification: "center"` - Buttons are centered horizontally

### Decrement Button
- **Type:** `text`
- **Content:** "-"
- **Modifiers:**
  - `font: {size: 24, weight: "bold"}` - Large, bold font
  - `color: "#FFFFFF"` - White text
  - `padding: {horizontal: 30, vertical: 15}` - Comfortable touch target
  - `background: {color: "#FF3B30"}` - Red background
  - `border: {radius: 12}` - Rounded corners
- **Events:**
  - `onTap: "decrementCounter"` - Handles touch input
  - `onClick: "decrementCounter"` - Handles mouse input

### Reset Button
- **Type:** `text`
- **Content:** "Reset"
- **Modifiers:**
  - `font: {size: 18, weight: "semibold"}` - Medium, semi-bold font
  - `color: "#1D1D1F"` - Dark text
  - `padding: {horizontal: 25, vertical: 15}` - Comfortable touch target
  - `background: {color: "#FFFFFF"}` - White background
  - `border: {width: 2, color: "#D2D2D7", radius: 12}` - Light gray border with rounded corners
- **Events:**
  - `onTap: "resetCounter"` - Handles touch input
  - `onClick: "resetCounter"` - Handles mouse input

### Increment Button
- **Type:** `text`
- **Content:** "+"
- **Modifiers:**
  - `font: {size: 24, weight: "bold"}` - Large, bold font
  - `color: "#FFFFFF"` - White text
  - `padding: {horizontal: 30, vertical: 15}` - Comfortable touch target
  - `background: {color: "#34C759"}` - Green background
  - `border: {radius: 12}` - Rounded corners
- **Events:**
  - `onTap: "incrementCounter"` - Handles touch input
  - `onClick: "incrementCounter"` - Handles mouse input

### Stats Section VStack
- **Type:** `vstack`
- **Modifiers:**
  - `gap: 8` - Vertical spacing between children
  - `alignment: "center"` - Children are centered horizontally
  - `padding: {horizontal: 20, vertical: 15}` - Padding inside the container
  - `background: {color: "#FFFFFF", opacity: 0.8}` - Semi-transparent white background
  - `border: {radius: 12}` - Rounded corners

### Stats Row HStack
- **Type:** `hstack`
- **Modifiers:**
  - `gap: 20` - Horizontal spacing between text items
  - `alignment: "center"` - Items are centered vertically
  - `justification: "spaceBetween"` - Items are spaced evenly

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
1. **Tap events** - For touch input
2. **Click events** - For mouse input
3. **Event handlers** - Functions that update state and UI

### State Features
1. **Signals** - Reactive state management
2. **State updates** - Modifying signal values
3. **UI updates** - Re-rendering based on state changes

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

## Extensions

This example can be extended with:

1. **Animation** - Add smooth transitions when count changes
2. **Theming** - Support light/dark mode
3. **Localization** - Support multiple languages
4. **Accessibility** - Add ARIA labels and keyboard support
5. **Persistence** - Save state to local storage
