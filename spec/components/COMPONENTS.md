# Pathland Component Specifications

This document provides detailed specifications for each core Pathland component type.

## 1. HStack Component

### 1.1 Overview

The `hstack` component arranges its children in a horizontal line (left to right in LTR locales, right to left in RTL locales).

### 1.2 Structure

```json
{
  "type": "hstack",
  "id": <string>,
  "modifiers": <HStackModifiers>,
  "events": <EventHandlers>,
  "children": [<Component>]
}
```

### 1.3 Modifiers

#### 1.3.1 Layout Modifiers

| Modifier | Type | Default | Description |
|----------|------|---------|-------------|
| `gap` | Length | 0 | Space between adjacent children |
| `alignment` | StackAlignment | "center" | Vertical alignment of children |
| `justification` | StackJustification | "leading" | Horizontal distribution of children |

#### 1.3.2 Spacing Modifiers

| Modifier | Type | Default | Description |
|----------|------|---------|-------------|
| `padding` | EdgeInsets | 0 | Inner padding |

#### 1.3.3 Border Modifiers

| Modifier | Type | Default | Description |
|----------|------|---------|-------------|
| `border` | BorderStyle | none | Border styling |

#### 1.3.4 Background Modifiers

| Modifier | Type | Default | Description |
|----------|------|---------|-------------|
| `background` | BackgroundStyle | none | Background styling |

#### 1.3.5 Frame Modifiers

| Modifier | Type | Default | Description |
|----------|------|---------|-------------|
| `frame` | FrameModifier | none | Size constraints |

### 1.4 Layout Behavior

#### 1.4.1 Main Axis (Horizontal)

- Children are laid out from leading to trailing
- The `justification` modifier controls distribution along this axis
- The `gap` modifier adds space between children

#### 1.4.2 Cross Axis (Vertical)

- The `alignment` modifier controls alignment along this axis
- All children are given the same height (the maximum of their intrinsic heights)
- Children are aligned according to the `alignment` value

#### 1.4.3 Sizing

- **Width**: Sum of children's widths + gaps + padding (unless constrained by frame)
- **Height**: Maximum of children's heights + padding (unless constrained by frame)

### 1.5 Example

```json
{
  "type": "hstack",
  "modifiers": {
    "gap": 16,
    "alignment": "center",
    "justification": "spaceBetween",
    "padding": {"all": 10},
    "border": {
      "width": 1,
      "color": "#CCCCCC",
      "radius": 8
    }
  },
  "children": [
    {"type": "text", "content": "Item 1"},
    {"type": "text", "content": "Item 2"},
    {"type": "text", "content": "Item 3"}
  ]
}
```

## 2. VStack Component

### 2.1 Overview

The `vstack` component arranges its children in a vertical line (top to bottom).

### 2.2 Structure

```json
{
  "type": "vstack",
  "id": <string>,
  "modifiers": <VStackModifiers>,
  "events": <EventHandlers>,
  "children": [<Component>]
}
```

### 2.3 Modifiers

VStack supports the same modifiers as HStack, but with different axis semantics.

#### 2.3.1 Layout Modifiers

| Modifier | Type | Default | Description |
|----------|------|---------|-------------|
| `gap` | Length | 0 | Space between adjacent children |
| `alignment` | StackAlignment | "center" | Horizontal alignment of children |
| `justification` | StackJustification | "leading" | Vertical distribution of children |

#### 2.3.2 Spacing Modifiers

| Modifier | Type | Default | Description |
|----------|------|---------|-------------|
| `padding` | EdgeInsets | 0 | Inner padding |

#### 2.3.3 Border Modifiers

| Modifier | Type | Default | Description |
|----------|------|---------|-------------|
| `border` | BorderStyle | none | Border styling |

#### 2.3.4 Background Modifiers

| Modifier | Type | Default | Description |
|----------|------|---------|-------------|
| `background` | BackgroundStyle | none | Background styling |

#### 2.3.5 Frame Modifiers

| Modifier | Type | Default | Description |
|----------|------|---------|-------------|
| `frame` | FrameModifier | none | Size constraints |

### 2.4 Layout Behavior

#### 2.4.1 Main Axis (Vertical)

- Children are laid out from top to bottom
- The `justification` modifier controls distribution along this axis
- The `gap` modifier adds space between children

#### 2.4.2 Cross Axis (Horizontal)

- The `alignment` modifier controls alignment along this axis
- All children are given the same width (the maximum of their intrinsic widths)
- Children are aligned according to the `alignment` value

#### 2.4.3 Sizing

- **Width**: Maximum of children's widths + padding (unless constrained by frame)
- **Height**: Sum of children's heights + gaps + padding (unless constrained by frame)

### 2.5 Example

```json
{
  "type": "vstack",
  "modifiers": {
    "gap": 20,
    "alignment": "leading",
    "justification": "center",
    "padding": {"horizontal": 20, "vertical": 30},
    "background": {
      "color": "#F8F8F8"
    }
  },
  "children": [
    {"type": "text", "content": "Header"},
    {"type": "text", "content": "Content"},
    {"type": "text", "content": "Footer"}
  ]
}
```

## 3. Text Component

### 3.1 Overview

The `text` component displays readable text. It is a leaf component (cannot have children).

### 3.2 Structure

```json
{
  "type": "text",
  "id": <string>,
  "content": <string>,
  "modifiers": <TextModifiers>,
  "events": <EventHandlers>
}
```

### 3.3 Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `content` | string | Yes | - | The text to display |

### 3.4 Modifiers

#### 3.4.1 Font Modifiers

| Modifier | Type | Default | Description |
|----------|------|---------|-------------|
| `font` | FontStyle | Platform default | Font styling |

`FontStyle` properties:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `family` | string or string[] | Platform default | Font family name(s) |
| `size` | number | Platform default | Font size in points |
| `weight` | FontWeight | "regular" | Font weight |
| `style` | FontStyleType | "normal" | Font style (italic, etc.) |
| `variant` | FontVariant | "normal" | Font variant |
| `letterSpacing` | number | 0 | Space between characters |
| `lineHeight` | number or string | Platform default | Line height |

`FontWeight` values:
- `"ultraLight"` (100)
- `"thin"` (200)
- `"light"` (300)
- `"regular"` (400)
- `"medium"` (500)
- `"semibold"` (600)
- `"bold"` (700)
- `"heavy"` (800)
- `"black"` (900)
- Numeric values 100-900

`FontStyleType` values:
- `"normal"`
- `"italic"`
- `"oblique"`

`FontVariant` values:
- `"normal"`
- `"smallCaps"`

#### 3.4.2 Text Layout Modifiers

| Modifier | Type | Default | Description |
|----------|------|---------|-------------|
| `lineLimit` | number or null | null | Maximum number of lines (null = unlimited) |
| `textAlignment` | HorizontalAlignment | "leading" | Text alignment |

`HorizontalAlignment` values:
- `"leading"` - Align to the leading edge (left in LTR, right in RTL)
- `"center"` - Center align
- `"trailing"` - Align to the trailing edge (right in LTR, left in RTL)

#### 3.4.3 Text Appearance Modifiers

| Modifier | Type | Default | Description |
|----------|------|---------|-------------|
| `color` | Color | Platform default | Text color |
| `truncationMode` | TextTruncationMode | "clip" | How to truncate overflow |
| `lineBreakMode` | TextLineBreakMode | "wordWrap" | How to break lines |

`TextTruncationMode` values:
- `"clip"` - Clip overflow
- `"head"` - Truncate from the beginning
- `"tail"` - Truncate from the end
- `"middle"` - Truncate from the middle

`TextLineBreakMode` values:
- `"wordWrap"` - Break at word boundaries
- `"characterWrap"` - Break at character boundaries
- `"clip"` - Clip to bounds
- `"headTruncation"` - Truncate from head
- `"tailTruncation"` - Truncate from tail
- `"middleTruncation"` - Truncate from middle

#### 3.4.4 Spacing Modifiers

| Modifier | Type | Default | Description |
|----------|------|---------|-------------|
| `padding` | EdgeInsets | 0 | Inner padding |

#### 3.4.5 Border Modifiers

| Modifier | Type | Default | Description |
|----------|------|---------|-------------|
| `border` | BorderStyle | none | Border styling |

#### 3.4.6 Background Modifiers

| Modifier | Type | Default | Description |
|----------|------|---------|-------------|
| `background` | BackgroundStyle | none | Background styling |

#### 3.4.7 Frame Modifiers

| Modifier | Type | Default | Description |
|----------|------|---------|-------------|
| `frame` | FrameModifier | none | Size constraints |

### 3.5 Layout Behavior

- The text component sizes itself to fit its content
- Width and height are determined by the text content and font
- Text wraps according to `lineBreakMode` and available width
- Text truncates according to `truncationMode` if it doesn't fit

### 3.6 Example

```json
{
  "type": "text",
  "content": "Hello, World!",
  "modifiers": {
    "font": {
      "family": ["Helvetica", "Arial", "sans-serif"],
      "size": 18,
      "weight": "bold",
      "style": "italic"
    },
    "color": "#333333",
    "lineLimit": 2,
    "textAlignment": "center",
    "truncationMode": "tail",
    "padding": {"all": 10},
    "background": {
      "color": "#FFFF00",
      "opacity": 0.5
    },
    "border": {
      "width": 2,
      "color": "#FF0000",
      "radius": 5
    }
  }
}
```

## 4. Common Modifier Types

### 4.1 StackAlignment

Used by both `hstack` and `vstack` for cross-axis alignment.

Values:
- `"leading"` / `"top"` - Align to the start
- `"center"` - Align to the center
- `"trailing"` / `"bottom"` - Align to the end

### 4.2 StackJustification

Used by both `hstack` and `vstack` for main-axis distribution.

Values:
- `"leading"` - Pack at the start
- `"center"` - Center with equal space on both sides
- `"trailing"` - Pack at the end
- `"spaceBetween"` - Equal space between children
- `"spaceAround"` - Equal space around children
- `"spaceEvenly"` - Equal space between and around children

### 4.3 EdgeInsets

Defines padding or margins for each edge.

Full form:
```json
{
  "top": <Length>,
  "right": <Length>,
  "bottom": <Length>,
  "left": <Length>
}
```

Shorthand forms (implementation-defined):
- Single number: Uniform insets on all edges
- Object with `horizontal` and `vertical`: Same insets for horizontal/vertical edges
- Object with `all`: Same insets for all edges

### 4.4 BorderStyle

```json
{
  "width": <Length>,
  "color": <Color>,
  "radius": <Length> | <CornerRadii>,
  "style": "solid" | "dotted" | "dashed" | "double"
}
```

### 4.5 CornerRadii

```json
{
  "topLeft": <Length>,
  "topRight": <Length>,
  "bottomLeft": <Length>,
  "bottomRight": <Length>
}
```

Shorthand: Single `Length` value applies to all corners.

### 4.6 BackgroundStyle

```json
{
  "color": <Color>,
  "gradient": <Gradient>,
  "image": <BackgroundImage>,
  "opacity": <number>
}
```

### 4.7 Gradient

Linear gradient:
```json
{
  "type": "linear",
  "direction": "toBottom" | "toRight" | "toTop" | "toLeft" | 
    "toTopLeft" | "toTopRight" | "toBottomLeft" | "toBottomRight" | <number>,
  "stops": [
    {"position": <number>, "color": <Color>},
    ...
  ]
}
```

Radial gradient:
```json
{
  "type": "radial",
  "center": <Point>,
  "radius": <number>,
  "stops": [
    {"position": <number>, "color": <Color>},
    ...
  ]
}
```

### 4.8 BackgroundImage

```json
{
  "source": <string>,
  "size": "cover" | "contain" | "stretch" | <Size>,
  "position": "center" | "top" | "bottom" | "left" | "right" | <Point>,
  "repeat": "noRepeat" | "repeat" | "repeatX" | "repeatY"
}
```

### 4.9 FrameModifier

```json
{
  "width": <Length>,
  "height": <Length>,
  "minWidth": <Length>,
  "maxWidth": <Length>,
  "minHeight": <Length>,
  "maxHeight": <Length>,
  "alignment": <Alignment>
}
```

### 4.10 Alignment

```json
{
  "horizontal": "leading" | "center" | "trailing",
  "vertical": "top" | "center" | "bottom"
}
```
