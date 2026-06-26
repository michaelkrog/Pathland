# Pathland Component Specifications

**Version:** 2.0.0-alpha  
**Status:** Draft  
**Last Updated:** June 26, 2026

> **IMPORTANT**: This document provides human-readable descriptions of Pathland components. The **[BINARY_PROTOCOL.md](../BINARY_PROTOCOL.md)** specification is the **sole authoritative source** for all protocol details including component types, property IDs, value types, and binary encoding formats. All cross-references in this document point to BINARY_PROTOCOL.md.

---

## Overview

This document describes the core Pathland component types and their properties as defined in the binary protocol. Each component is identified by a **numeric component type ID** and supports specific **property IDs** that can be set via the `CREATE_NODE` and `SET_PROPERTY` instructions.

**Key Principles:**
- Components are created using `CREATE_NODE` with a `componentType` ID
- Properties are set using numeric `propertyId` values (not strings)
- All property values are encoded using the binary protocol's `valueType` system
- Style properties can be applied to any component using the style property ID range (0x1000-0x10FF)

---

## 1. HSTACK Component (0x0001)

**Component Type ID:** `0x0001` (HSTACK)

The `HSTACK` component arranges its children in a horizontal line (left to right in LTR locales, right to left in RTL locales).

### 1.1 Binary Representation

To create an HSTACK in the binary protocol:

```
CREATE_NODE (0x01)
  nodeId: u32
  componentType: 0x0001 (HSTACK)
  propertyCount: u8
  [property entries...]
```

### 1.2 Component-Specific Properties

| Property | Property ID | Value Type | Description | Binary Encoding |
|----------|-------------|------------|-------------|----------------|
| `spacing` | 0x0001 | F32 (0x04) | Space between adjacent children | `[u16 propertyId=0x0001][u8 valueType=0x04][f32 value]` |
| `alignment` | 0x0002 | ENUM (0x06) | Cross-axis (vertical) alignment of children | `[u16 propertyId=0x0002][u8 valueType=0x06][u8 enumValue]` |
| `justification` | 0x0003 | ENUM (0x06) | Main-axis (horizontal) distribution of children | `[u16 propertyId=0x0003][u8 valueType=0x06][u8 enumValue]` |
| `contentMargins` | 0x0005 | F32 or DESIGN_TOKEN | Internal margins around children | `[u16 propertyId=0x0005][u8 valueType][value...]` |

**Alignment Enum Values (Cross-axis):**
- `0x00` = START (align to top/leading edge)
- `0x01` = CENTER
- `0x02` = END (align to bottom/trailing edge)
- `0x03` = STRETCH (fill available space)

**Justification Enum Values (Main-axis):**
- `0x00` = START (pack at leading edge)
- `0x01` = CENTER (center with equal space on both sides)
- `0x02` = END (pack at trailing edge)
- `0x03` = SPACE_BETWEEN (equal space between children)
- `0x04` = SPACE_AROUND (equal space around children)
- `0x05` = SPACE_EVENLY (equal space between and around children)

### 1.3 Layout Behavior

**Main Axis (Horizontal):**
- Children are laid out from leading to trailing
- The `justification` property controls distribution along this axis
- The `spacing` property adds space between children

**Cross Axis (Vertical):**
- The `alignment` property controls alignment along this axis
- All children are given the same height (maximum of their intrinsic heights)
- Children are aligned according to the `alignment` value

**Sizing:**
- **Width**: Sum of children's widths + gaps + padding (unless constrained by frame)
- **Height**: Maximum of children's heights + padding (unless constrained by frame)

See **[BINARY_PROTOCOL.md - HSTACK/VSTACK Properties](../BINARY_PROTOCOL.md#hstack--vstack-properties)** for complete property definitions.

---

## 2. VSTACK Component (0x0002)

**Component Type ID:** `0x0002` (VSTACK)

The `VSTACK` component arranges its children in a vertical line (top to bottom).

### 2.1 Binary Representation

To create a VSTACK in the binary protocol:

```
CREATE_NODE (0x01)
  nodeId: u32
  componentType: 0x0002 (VSTACK)
  propertyCount: u8
  [property entries...]
```

### 2.2 Component-Specific Properties

VSTACK supports the same properties as HSTACK, but with different axis semantics:

| Property | Property ID | Value Type | Description | Axis |
|----------|-------------|------------|-------------|------|
| `spacing` | 0x0001 | F32 (0x04) | Space between adjacent children | Vertical |
| `alignment` | 0x0002 | ENUM (0x06) | Cross-axis (horizontal) alignment of children | Horizontal |
| `justification` | 0x0003 | ENUM (0x06) | Main-axis (vertical) distribution of children | Vertical |
| `contentMargins` | 0x0005 | F32 or DESIGN_TOKEN | Internal margins around children | Both |

**Alignment Enum Values (Cross-axis - Horizontal):**
- `0x00` = START (align to leading edge)
- `0x01` = CENTER
- `0x02` = END (align to trailing edge)
- `0x03` = STRETCH (fill available width)

**Justification Enum Values (Main-axis - Vertical):**
- `0x00` = START (pack at top)
- `0x01` = CENTER (center with equal space above and below)
- `0x02` = END (pack at bottom)
- `0x03` = SPACE_BETWEEN (equal space between children)
- `0x04` = SPACE_AROUND (equal space around children)
- `0x05` = SPACE_EVENLY (equal space between and around children)

### 2.3 Layout Behavior

**Main Axis (Vertical):**
- Children are laid out from top to bottom
- The `justification` property controls distribution along this axis
- The `spacing` property adds space between children

**Cross Axis (Horizontal):**
- The `alignment` property controls alignment along this axis
- All children are given the same width (maximum of their intrinsic widths)
- Children are aligned according to the `alignment` value

**Sizing:**
- **Width**: Maximum of children's widths + padding (unless constrained by frame)
- **Height**: Sum of children's heights + gaps + padding (unless constrained by frame)

See **[BINARY_PROTOCOL.md - Component Type Table](../BINARY_PROTOCOL.md#component-type-table)** for complete type definitions.

---

## 3. TEXT Component (0x0003)

**Component Type ID:** `0x0003` (TEXT)

The `TEXT` component displays readable text. It is a **leaf component** (cannot have children).

### 3.1 Binary Representation

To create a TEXT component in the binary protocol:

```
CREATE_NODE (0x01)
  nodeId: u32
  componentType: 0x0003 (TEXT)
  propertyCount: u8
  [property entries...]
```

### 3.2 Component-Specific Properties

| Property | Property ID | Value Type | Description | Default |
|----------|-------------|------------|-------------|---------|
| `text` | 0x000A | STRING (0x05) | Text content | Required |
| `lineLimit` | 0x000B | U32 (0x02) | Maximum number of lines (0 = unlimited) | 0 |
| `textAlignment` | 0x000C | ENUM (0x06) | Text alignment within bounds | LEADING |
| `truncationMode` | 0x000D | ENUM (0x06) | How to truncate overflowing text | CLIP |
| `lineSpacing` | 0x000E | F32 (0x04) | Additional space between lines in points | 0 |
| `baselineOffset` | 0x000F | F32 (0x04) | Baseline offset in points (positive = down, negative = up) | 0 |

**TextAlignment Enum Values:**
- `0x00` = LEADING (align to leading edge - left in LTR, right in RTL)
- `0x01` = CENTER (center align)
- `0x02` = TRAILING (align to trailing edge - right in LTR, left in RTL)

**TruncationMode Enum Values:**
- `0x00` = HEAD (truncate from the beginning, ellipsis at start)
- `0x01` = MIDDLE (truncate in middle)
- `0x02` = TAIL (truncate from the end, ellipsis at end)
- `0x03` = CLIP (clip without ellipsis)

### 3.3 Layout Behavior

- The text component sizes itself to fit its content
- Width and height are determined by the text content, font, and constraints
- Text wraps according to available width (controlled by frame constraints)
- Text truncates according to `truncationMode` if it doesn't fit

### 3.4 Style Properties

TEXT components support all **style properties** (ID range 0x1000-0x10FF) including:

| Property | Property ID | Value Type | Description |
|----------|-------------|------------|-------------|
| `backgroundColor` | 0x1001 | COLOR or DESIGN_TOKEN | Background color |
| `color` | 0x100A | COLOR or DESIGN_TOKEN | Text color (sRGB, semantic token, or design token) |
| `fontSize` | 0x1007 | F32 or DESIGN_TOKEN | Font size in points or typography token |
| `fontWeight` | 0x1008 | ENUM or DESIGN_TOKEN | Font weight (enum or typography token) |
| `fontFamily` | 0x1009 | STRING or DESIGN_TOKEN | Font family name or typography token |
| `opacity` | 0x100D | F32 | Opacity (0.0 = transparent, 1.0 = opaque) |
| `visible` | 0x100E | U8 | Visibility (0 = hidden, 1 = visible) |
| `padding` | 0x1006 | F32 or DESIGN_TOKEN | Uniform padding |
| `width` | 0x100B | F32 | Width in points (-1.0 = fill, -2.0 = hug content) |
| `height` | 0x100C | F32 | Height in points (-1.0 = fill, -2.0 = hug content) |

**FontWeight Enum Values:**
- `0x00` = ULTRA_LIGHT (100)
- `0x01` = THIN (200)
- `0x02` = LIGHT (300)
- `0x03` = REGULAR (400)
- `0x04` = MEDIUM (500)
- `0x05` = SEMIBOLD (600)
- `0x06` = BOLD (700)
- `0x07` = HEAVY (800)
- `0x08` = BLACK (900)

See **[BINARY_PROTOCOL.md - TEXT Properties](../BINARY_PROTOCOL.md#text-properties)** for complete property definitions.

See **[BINARY_PROTOCOL.md - Color Value Type](../BINARY_PROTOCOL.md#color-value-type)** for complete color encoding details.

---

## 4. BUTTON Component (0x0004)

**Component Type ID:** `0x0004` (BUTTON)

The `BUTTON` component represents an interactive button element.

### 4.1 Binary Representation

```
CREATE_NODE (0x01)
  nodeId: u32
  componentType: 0x0004 (BUTTON)
  propertyCount: u8
  [property entries...]
```

### 4.2 Component-Specific Properties

| Property | Property ID | Value Type | Description |
|----------|-------------|------------|-------------|
| `icon` | 0x2101 | DESIGN_TOKEN | Icon token reference (e.g., `icon.checkmark`) |

### 4.3 Semantic Properties

BUTTON supports **semantic properties** that describe intent and state:

| Property | Property ID | Value Type | Description |
|----------|-------------|------------|-------------|
| `role` | 0x2001 | ENUM | Semantic role (PRIMARY, SECONDARY, DESTRUCTIVE, etc.) |
| `state` | 0x2002 | ENUM | Current state (NORMAL, DISABLED, LOADING, etc.) |
| `enabled` | 0x2003 | U8 | Whether the component is enabled (0=false, 1=true) |
| `selected` | 0x2004 | U8 | Whether the component is selected (0=false, 1=true) |

**Role Enum Values:**
- `0x00` = DEFAULT
- `0x01` = PRIMARY
- `0x02` = SECONDARY
- `0x03` = DESTRUCTIVE

**State Enum Values:**
- `0x00` = NORMAL
- `0x01` = HOVER (set by renderer)
- `0x02` = ACTIVE (set by renderer)
- `0x03` = FOCUS (set by renderer)
- `0x04` = DISABLED (set by application)
- `0x05` = LOADING

**Important:** Interaction states (HOVER, ACTIVE, FOCUS) are managed by the renderer based on user input. The application should only set logical states (DISABLED, LOADING).

See **[BINARY_PROTOCOL.md - Semantic Properties](../BINARY_PROTOCOL.md#semantic-properties)** for complete semantic property definitions.

---

## 5. IMAGE Component (0x0005)

**Component Type ID:** `0x0005` (IMAGE)

The `IMAGE` component displays an image. Properties will be defined in a future version of the protocol.

See **[BINARY_PROTOCOL.md - Component Type Table](../BINARY_PROTOCOL.md#component-type-table)** for the complete list of defined component types.

---

## 6. SWITCH Component (0x0006)

**Component Type ID:** `0x0006` (SWITCH)

The `SWITCH` component represents a toggle switch. Properties will be defined in a future version of the protocol.

---

## 7. TEXT_FIELD Component (0x0007)

**Component Type ID:** `0x0007` (TEXT_FIELD)

The `TEXT_FIELD` component represents a text input field.

### 7.1 Component-Specific Properties

| Property | Property ID | Value Type | Description |
|----------|-------------|------------|-------------|
| `placeholder` | 0x2201 | STRING (0x05) | Placeholder text when empty |
| `value` | 0x2202 | STRING (0x05) | Current text value |

See **[BINARY_PROTOCOL.md - Text Field-Specific Properties](../BINARY_PROTOCOL.md#text-field-specific-properties)** for complete property definitions.

---

## 8. SPACER Component (0x0008)

**Component Type ID:** `0x0008` (SPACER)

The `SPACER` component represents flexible space that expands to fill available space along the main axis of its parent stack. This is useful for pushing children to opposite edges or creating flexible layouts.

### 8.1 Binary Representation

```
CREATE_NODE (0x01)
  nodeId: u32
  componentType: 0x0008 (SPACER)
  propertyCount: 0
```

### 8.2 Properties

SPACER has no component-specific properties. It expands to fill available space based on its parent's layout rules.

### 8.3 Use Cases

- Push children to opposite edges in a stack
- Create flexible spacing between groups of children
- Fill remaining space in a layout

See **[BINARY_PROTOCOL.md - Component Type Table](../BINARY_PROTOCOL.md#component-type-table)** for complete type definitions.

---

## Style Properties (All Components)

All components support the following **style properties** (ID range 0x1000-0x10FF).

| Property | Property ID | Value Type | Description |
|----------|-------------|------------|-------------|
| `backgroundColor` | 0x1001 | COLOR or DESIGN_TOKEN | Background color (sRGB, semantic token, or design token) |
| `backgroundOpacity` | 0x1002 | F32 (0x04) | Opacity (0.0 to 1.0) |
| `borderWidth` | 0x1003 | F32 or DESIGN_TOKEN | Border width (pixels or spacing token) |
| `borderColor` | 0x1004 | COLOR or DESIGN_TOKEN | Border color |
| `borderRadius` | 0x1005 | F32 or DESIGN_TOKEN | Border radius (pixels or shape token) |
| `padding` | 0x1006 | F32 or DESIGN_TOKEN | Uniform padding (pixels or spacing token) |
| `fontSize` | 0x1007 | F32 or DESIGN_TOKEN | Font size (points or typography token) |
| `fontWeight` | 0x1008 | ENUM or DESIGN_TOKEN | Font weight (enum or typography token) |
| `fontFamily` | 0x1009 | STRING or DESIGN_TOKEN | Font family name or typography token |
| `color` | 0x100A | COLOR or DESIGN_TOKEN | Text color (sRGB, semantic token, or design token) |
| `width` | 0x100B | F32 (0x04) | Width in points (-1.0 = fill, -2.0 = hug content) |
| `height` | 0x100C | F32 (0x04) | Height in points (-1.0 = fill, -2.0 = hug content) |
| `opacity` | 0x100D | F32 (0x04) | Opacity value (0.0 = transparent, 1.0 = opaque) |
| `visible` | 0x100E | U8 (0x01) | Visibility (0 = hidden, 1 = visible) |
| `zIndex` | 0x100F | F32 (0x04) | Stacking order (higher values appear on top) |
| `clipsToBounds` | 0x1010 | U8 (0x01) | Clip content that overflows (0 = false, 1 = true) |

**Special Width/Height Values:**
- `-1.0` = Fill available space
- `-2.0` = Hug content (size to fit)

See **[BINARY_PROTOCOL.md - Style Properties](../BINARY_PROTOCOL.md#style-properties)** for complete style property definitions.

---

## Design Token Integration

All components support **design tokens** via the `DESIGN_TOKEN` value type (0x08).

### Token Path Examples

| Token Path | Description | Usage |
|------------|-------------|-------|
| `color.primary` | Primary brand color | Background color for primary buttons |
| `color.text.primary` | Primary text color | Text color for main content |
| `font.body` | Body text font | Font family for text components |
| `space.2` | Spacing value | Padding, gaps, margins |
| `radius.medium` | Medium border radius | Border radius for cards |

See **[BINARY_PROTOCOL.md - Design Token System](../BINARY_PROTOCOL.md#design-token-system)** for complete design token specifications.

---

## Property ID Ranges

| Range | Category | Description |
|-------|----------|-------------|
| 0x0001-0x0003 | HSTACK/VSTACK Properties | spacing, alignment, justification |
| 0x000A-0x000F | TEXT Properties | text, lineLimit, textAlignment, truncationMode, lineSpacing, baselineOffset |
| 0x1000-0x10FF | Style Properties | backgroundColor, border, padding, font, opacity, etc. |
| 0x2000-0x20FF | Semantic Properties | role, state, enabled, selected |
| 0x2100-0x21FF | Button Properties | icon |
| 0x2200-0x22FF | Text Field Properties | placeholder, value |

See **[BINARY_PROTOCOL.md - Property ID Definitions](../BINARY_PROTOCOL.md#property-id-definitions)** for complete property tables.

---

## Reserved IDs

| Range | Purpose |
|-------|---------|
| 0x0000 | Reserved (do not use) |
| 0x0004, 0x0006-0x0009 | Future HSTACK/VSTACK properties |
| 0x0010-0x0FFF | Future TEXT properties |
| 0x1011-0xFFFF | Future properties |
| 0x0009-0x7FFF | Future core component types |
| 0x8000-0xFFFF | Custom/experimental component types |

Implementations SHOULD ignore nodes with unknown component types or properties.

---

## Appendix A: Component Type Summary

| Component | ID (hex) | ID (decimal) | Can Have Children | Description |
|-----------|----------|--------------|-------------------|-------------|
| HSTACK | 0x0001 | 1 | Yes | Horizontal stack container |
| VSTACK | 0x0002 | 2 | Yes | Vertical stack container |
| TEXT | 0x0003 | 3 | No | Text display component |
| BUTTON | 0x0004 | 4 | Yes | Button component |
| IMAGE | 0x0005 | 5 | No | Image display component |
| SWITCH | 0x0006 | 6 | No | Toggle switch component |
| TEXT_FIELD | 0x0007 | 7 | No | Text input field component |
| SPACER | 0x0008 | 8 | No | Flexible space component |

---

## Appendix B: Quick Reference

For complete and authoritative protocol details, always refer to:

- **[BINARY_PROTOCOL.md](../BINARY_PROTOCOL.md)** - The official protocol specification
- **[Component Type Table](../BINARY_PROTOCOL.md#component-type-table)** - Complete component type definitions
- **[Property ID Tables](../BINARY_PROTOCOL.md#property-id-definitions)** - All property definitions by component type
- **[Value Type Table](../BINARY_PROTOCOL.md#value-type-table)** - All value type encodings
- **[Color Value Type](../BINARY_PROTOCOL.md#color-value-type)** - Color encoding specifications
- **[Design Token System](../BINARY_PROTOCOL.md#design-token-system)** - Design token specifications
- **[Enum Definitions](../BINARY_PROTOCOL.md#enum-definitions)** - All enum value tables

---

**Note**: This document is a **human-readable guide** to Pathland components. The binary protocol specification (BINARY_PROTOCOL.md) is the only authoritative source for protocol implementation. All numeric IDs, encodings, and behavior defined in this document must match BINARY_PROTOCOL.md exactly.