# Pathland Primitive Views

**Wire protocol version:** 1
**Status:** Draft
**Last Updated:** August 28, 2026

---

## Purpose

This document is the **semantic catalog of primitive views** the Pathland protocol
must support. It maps every primitive view onto its protocol component type
(`TREE::CREATE_NODE`), the modifiers that shape it (see
[MODIFIERS.md](./MODIFIERS.md)), and the core events it can produce (see
[EVENTS.md](./EVENTS.md)).

This file is **implementation-ready**: an emitter and a renderer (GTK, HTML/SSR,
DOM/ngui, or a new backend) can be written from these tables alone. The wire
encoding rules live in [OPCODE.md](./OPCODE.md); this file does not repeat them.

### Relationship to other specs

| File | Role |
|------|------|
| [OPCODE.md](./OPCODE.md) | Wire format: categories, commands, 16-byte opcode layout, ring/arena, value types |
| **PRIMITIVES.md** (this file) | Which **views** exist and their protocol IDs |
| [MODIFIERS.md](./MODIFIERS.md) | Which **modifiers** (protocol properties) exist and how they encode |
| [EVENTS.md](./EVENTS.md) | Which **core events** (raw inputs) exist and how they encode |
| [CONFORMANCE.md](./CONFORMANCE.md) | Golden byte vectors |

### Status legend

- **✅ Implemented** — the component type and/or property exists in
  `pathland_core::constants` and is exercised by the Rust engine, the Java DSL,
  or a renderer today.
- **🚧 Draft** — the protocol ID is **allocated** in this document (spec-first,
  per the "modify the spec first" rule) but the primitive is not implemented
  anywhere yet. IDs are reserved and MUST NOT be reused; implementers may start
  on them.

### Non-negotiables (recap)

- Views are **declarative structure + constraint properties**, never positions.
  The engine emits `WHAT` (VStack, HStack, Text, …), never `WHERE`.
- Renderers are **stateless**: they map the opcode stream onto native elements
  and lay those elements out with their native layout engine.
- **Native elements everywhere**: VStack → GTK box / CSS flex column / ngui
  `ui-vstack`; Text → GTK label / `<span>` / ngui `ui-text`. Never a generic
  canvas unless the platform has no native equivalent.

---

## 1. Layout

Layout primitives arrange their children. They carry the constraint properties
`SPACING` (0x0001), `ALIGNMENT` (0x0002), and `CONTENT_MARGINS` (0x0005), plus
any layout modifiers from [MODIFIERS.md](./MODIFIERS.md#1-layout).

| View | Component | Status | Properties | Emits |
|------|-----------|--------|------------|-------|
| `VStack` | `VSTACK` 0x0002 | ✅ | SPACING, ALIGNMENT, CONTENT_MARGINS | pointer/key via listeners |
| `HStack` | `HSTACK` 0x0001 | ✅ | SPACING, ALIGNMENT, CONTENT_MARGINS | pointer/key via listeners |
| `ZStack` | `ZSTACK` 0x000F | 🚧 | ALIGNMENT | pointer/key via listeners |
| `Spacer` | `SPACER` 0x0008 | ✅ | — | — |
| `Divider` | `DIVIDER` 0x0010 | 🚧 | COLOR, BORDER_WIDTH | — |
| `Group` | `GROUP` 0x0011 | 🚧 | (transparent) | — |
| `LazyVStack` | `LAZY_VSTACK` 0x0012 | 🚧 | SPACING, ALIGNMENT | — |
| `LazyHStack` | `LAZY_HSTACK` 0x0013 | 🚧 | SPACING, ALIGNMENT | — |
| `LazyVGrid` | `LAZY_VGRID` 0x0014 | 🚧 | ALIGNMENT, SPACING | — |
| `LazyHGrid` | `LAZY_HGRID` 0x0015 | 🚧 | ALIGNMENT, SPACING | — |
| `Grid` | `GRID` 0x000B | ✅ | ALIGNMENT, SPACING | — |
| `List` | `LIST` 0x000A | ✅ | SPACING | pointer/key via listeners; item `SELECTED` |
| `ScrollView` | `SCROLLVIEW` 0x0009 | ✅ | — | `SCROLL` 🚧, `WHEEL` 🚧 (EVENTS.md) |

### VStack / HStack — ✅ `VSTACK` 0x0002 / `HSTACK` 0x0001

Vertical / horizontal stack of children, laid out by the native renderer.

- **Protocol**: a container node with children (`TREE::INSERT_CHILD`).
- **Properties**: `SPACING` (F32 gap between children), `ALIGNMENT` (ENUM
  cross-axis alignment: `Leading`=0, `Center`=1, `Trailing`=2, `Fill`=3),
  `CONTENT_MARGINS` (F32, uniform inset between the stack edge and its content).
- **Renderer mapping**: GTK `GtkBox` (orientation vertical/horizontal); HTML
  flex column/row (`display:flex; flex-direction:column|row`, `gap` for spacing,
  `align-items`/`justify-content` for alignment); ngui `ui-vstack`/`ui-hstack`.
- **Events**: none by default; any child (or the stack itself) may declare
  `EVENT_LISTENERS` (see [EVENTS.md](./EVENTS.md)).

### ZStack — 🚧 `ZSTACK` 0x000F

Children rendered on top of each other (overlap), back-to-front in child order.

- **Protocol**: a container node; child index = draw order (later = on top).
- **Properties**: `ALIGNMENT` (ENUM, cross-axis alignment of all children
  within the stack bounds).
- **Renderer mapping**: GTK `GtkOverlay`; HTML absolutely-positioned children
  inside a positioned container; ngui `ui-zstack`.
- **Note**: the Java DSL currently materializes `ZStack` as `COMMENT` (0x000C);
  once `ZSTACK` is implemented the DSL and renderers should switch to the real
  component id.

### Spacer — ✅ `SPACER` 0x0008

A flexible filler: expands to take all remaining space on its stack's main axis.

- **Protocol**: a leaf node with no properties. Its expand behavior is implied
  by its component type; renderers implement it as an expanding element
  (`flex-grow:1` in HTML, an expanding box in GTK).
- **Renderer mapping**: GTK widget with `hexpand`/`vexpand` set from the parent
  orientation; HTML element with `flex:1`.

### Divider — 🚧 `DIVIDER` 0x0010

A thin horizontal or vertical line (SwiftUI `Divider`).

- **Protocol**: a leaf node; orientation is implied by the parent stack axis.
- **Properties**: `COLOR` (0x100A), `BORDER_WIDTH` (0x1003) — the line thickness.
- **Renderer mapping**: GTK `GtkSeparator`; HTML `<hr>` / `<div>` with a border.

### Group — 🚧 `GROUP` 0x0011

A **transparent** container: applies modifiers to all children without creating
a native element (SwiftUI `Group`).

- **Protocol**: a container node the renderer MUST NOT materialize as a widget.
  Children are hoisted into the nearest rendered ancestor.
- **Renderer mapping**: all renderers — render children directly, ignore the
  group node itself (like `COMMENT` but structural).

### LazyVStack / LazyHStack — 🚧 `LAZY_VSTACK` 0x0012 / `LAZY_HSTACK` 0x0013

Stacks that only realize children near the visible region (virtualized).

- **Protocol**: same container semantics and properties as `VStack`/`HStack`.
  The component type is the **virtualization hint**: a renderer MAY defer
  realizing off-screen children until scrolled into view.
- **Renderer mapping**: GTK `GtkListBox`/`GtkScrolledWindow` with recycling;
  HTML/CSS content-visibility; ngui virtualization.

### LazyVGrid / LazyHGrid — 🚧 `LAZY_VGRID` 0x0014 / `LAZY_HGRID` 0x0015

Virtualized grids: a fixed number of columns (VGrid) / rows (HGrid) with
virtualized scrolling along the other axis.

- **Protocol**: a container node whose children are the **cells** (row-major /
  column-major in insertion order). The axis count is carried by `WIDTH`/
  `HEIGHT` where `FILL` (-1.0) means "auto-fit available space" and any other
  value is the fixed count of cells per axis.
- **Properties**: `ALIGNMENT`, `SPACING`, `WIDTH`/`HEIGHT` (cell-axis count).
- **Renderer mapping**: CSS grid / `GtkGrid` with recycling.

### Grid — ✅ `GRID` 0x000B

A fixed grid of children.

- **Protocol**: a container node whose children are cells, row-major in
  insertion order.
- **Properties**: `ALIGNMENT`, `SPACING`, `WIDTH`/`HEIGHT` (cell-axis count;
  `FILL` = auto-fit).
- **Renderer mapping**: GTK `GtkGrid`; HTML CSS grid; ngui `ui-grid`.

### List — ✅ `LIST` 0x000A

A scrolling, optionally selectable list of rows.

- **Protocol**: a container node whose children are the rows.
- **Properties**: `SPACING` (row gap). Row selection is carried per-row via the
  semantic `SELECTED` (0x2004); a renderer reports row selection changes by
  emitting `EVENT::VALUE_CHANGED` — see [EVENTS.md](./EVENTS.md).
- **Renderer mapping**: GTK `GtkListBox`/`GtkTreeView`; HTML `<ul>`/`<div>` in a
  scroll container; ngui list.

### ScrollView — ✅ `SCROLLVIEW` 0x0009

A container whose content may be larger than its bounds and scrolls.

- **Protocol**: a container node; its single child (or children) is the content.
- **Properties**: layout modifiers only; the axes to scroll are implied by the
  content overflow.
- **Events**: with the `SCROLL` (bit 8) listener the renderer reports the
  scroll offset via `EVENT::SCROLL`; with `WHEEL` (bit 9) it reports
  wheel/trackpad deltas via `EVENT::WHEEL` (both draft, see
  [EVENTS.md](./EVENTS.md)).
- **Renderer mapping**: GTK `GtkScrolledWindow`; HTML overflow container; ngui
  scroll view.

---

## 2. Text & Input

| View | Component | Status | Properties | Emits |
|------|-----------|--------|------------|-------|
| `Text` | `TEXT` 0x0003 | ✅ | text, LINE_LIMIT, TEXT_ALIGNMENT, TRUNCATION_MODE, text modifiers | pointer/key via listeners |
| `Label` | `LABEL` 0x001F | 🚧 | text + icon child | — |
| `TextField` | `TEXT_FIELD` 0x0007 | ✅ | LABEL, PROMPT, IS_SECURE 🚧 | `TEXT_CHANGED` ✅, `EDITING_CHANGED` 🚧, `SUBMIT` 🚧, `FOCUS_CHANGED` 🚧 |
| `SecureField` | `SECURE_FIELD` 0x0017 | 🚧 | same as TextField | same as TextField |

### Text — ✅ `TEXT` 0x0003

A run of text.

- **Protocol**: a leaf node; its content is set via `STYLE::SET_TEXT`
  (`A=nodeId, B=arenaRef`) or bound to a signal.
- **Properties**: `LINE_LIMIT` (0x000B, U32 max lines), `TEXT_ALIGNMENT`
  (0x000C, ENUM), `TRUNCATION_MODE` (0x000D, ENUM), plus all text-formatting
  and appearance modifiers from [MODIFIERS.md](./MODIFIERS.md).
- **Renderer mapping**: GTK `GtkLabel`; HTML `<span>`/`<p>`; ngui `ui-text`.

### Label — 🚧 `LABEL` 0x001F

A composite of an icon (a child `IMAGE` or `SHAPE`) and text (SwiftUI `Label`).

- **Protocol**: a container node with **exactly two children**: the icon and
  the text. The renderer lays them out horizontally with the text's font.
- **Properties**: text modifiers apply to the text child; size modifiers apply
  to the icon child.

### TextField — ✅ `TEXT_FIELD` 0x0007

A single-line text input.

- **Protocol**: a leaf node. The caption and placeholder are `STRING`
  properties (`LABEL` 0x200A, `PROMPT` 0x200B); the current value is bound to a
  signal or held by the app and reported back host→guest on change.
- **Properties**: `LABEL`, `PROMPT`, `IS_SECURE` (🚧 0x200D, U8 0/1),
  `ENABLED`, `STATE`, text/appearance modifiers.
- **Events** (see [EVENTS.md](./EVENTS.md)):
  - `TEXT_CHANGED` (0x07) — ✅ the value changed; new text in the string
    section.
  - `EDITING_CHANGED` (🚧 0x09) — editing session began/ended (SwiftUI
    `onEditingChanged`).
  - `SUBMIT` (🚧 0x0A) — return/commit pressed (SwiftUI `onSubmit`/`onCommit`).
  - `FOCUS_CHANGED` (🚧 0x08) — the field gained/lost focus.
- **Renderer mapping**: GTK `GtkEntry`; HTML `<input type="text">`; ngui input.

### SecureField — 🚧 `SECURE_FIELD` 0x0017

A `TextField` whose input is masked.

- **Protocol**: identical to `TEXT_FIELD`; the component type implies masked
  rendering (equivalent to `TextField` + `IS_SECURE`). The renderer MUST mask
  the displayed characters and MUST NOT echo the value on submit.
- **Properties / events**: same as `TextField`.

---

## 3. Images

| View | Component | Status | Properties | Emits |
|------|-----------|--------|------------|-------|
| `Image` | `IMAGE` 0x0005 | ✅ | IMAGE_SOURCE 🚧, CONTENT_MODE 🚧 | pointer/key via listeners |
| `AsyncImage` | `IMAGE` 0x0005 | 🚧 | IMAGE_SOURCE (URL) | — |

### Image — ✅ `IMAGE` 0x0005

A static image.

- **Protocol**: a leaf node. Its source is a `STRING` property
  (`IMAGE_SOURCE` 🚧 0x1002): a resource name, a file path, or an absolute URL.
  Until `IMAGE_SOURCE` is implemented the source is a DSL-side concern.
- **Properties**: `IMAGE_SOURCE` (🚧 0x1002, STRING), `CONTENT_MODE`
  (🚧 0x001C, ENUM `Fit`=0 / `Fill`=1), size modifiers (`WIDTH`/`HEIGHT`,
  `FILL`/`HUG_CONTENT`), `OPACITY`, `CLIPS_TO_BOUNDS`.
- **Renderer mapping**: GTK `GtkPicture`/`GtkImage`; HTML `<img>`; ngui
  `ui-image`.

### AsyncImage — 🚧 mapped to `IMAGE`

SwiftUI's `AsyncImage` (remote/async loading) is **not a separate component**.
It is `IMAGE` with `IMAGE_SOURCE` set to an absolute URL; the renderer loads it
asynchronously and re-issues `SET_PROPERTY(IMAGE_SOURCE)` if the source changes.

---

## 4. Controls & Indicators

| View | Component | Status | Properties | Emits |
|------|-----------|--------|------------|-------|
| `Button` | `BUTTON` 0x0004 | ✅ | label text | tap (pointer down/up) |
| `Toggle` | `SWITCH` 0x0006 / `CHECKBOX` 0x000D | ✅ | SELECTED | `VALUE_CHANGED` (0/1) |
| `Slider` | `SLIDER` 0x000E | ✅ | VALUE, MIN_VALUE, MAX_VALUE | `VALUE_CHANGED` |
| `Stepper` | `STEPPER` 0x0018 | 🚧 | VALUE, STEP_VALUE | `VALUE_CHANGED` |
| `Picker` | `PICKER` 0x0019 | 🚧 | SELECTION, PICKER_STYLE | `VALUE_CHANGED` |
| `DatePicker` | `DATE_PICKER` 0x001A | 🚧 | DATE_VALUE, DATE_PICKER_MODE | `VALUE_CHANGED` |
| `ColorPicker` | `COLOR_PICKER` 0x001B | 🚧 | COLOR_VALUE | `VALUE_CHANGED` |
| `ProgressView` | `PROGRESS_VIEW` 0x001C | 🚧 | PROGRESS, IS_INDETERMINATE | — |
| `Gauge` | `GAUGE` 0x001D | 🚧 | VALUE, MIN_VALUE, MAX_VALUE | `VALUE_CHANGED` |
| `Menu` | `MENU` 0x001E | 🚧 | items, SELECTION | `VALUE_CHANGED` |
| `Link` | (→ `BUTTON`) | 🚧 | url | tap |

### Button — ✅ `BUTTON` 0x0004

A tappable control with a label.

- **Protocol**: a leaf node whose label text is set via `STYLE::SET_TEXT`.
  Custom labels (icon + text) are expressed by making `BUTTON` a container when
  the app needs it; a leaf `BUTTON` carries only text.
- **Properties**: text/appearance modifiers, `ENABLED`, `STATE`,
  `EVENT_LISTENERS`. The tap gesture is the app-side composition of the
  `POINTER_DOWN`/`POINTER_UP` listeners (see [EVENTS.md](./EVENTS.md)).
- **Events**: with the `POINTER_DOWN`+`POINTER_UP` listeners set (always for a
  button), the renderer reports the raw pointer events; the app composes a tap.
- **Renderer mapping**: GTK `GtkButton`; HTML `<button>`; ngui `ui-button`.
  Button styles are renderer/token-owned (see OPCODE.md design tokens).

### Toggle — ✅ `SWITCH` 0x0006 / `CHECKBOX` 0x000D

A boolean control. SwiftUI `Toggle` maps to two native forms:

- `SWITCH` — the sliding-pill form (iOS/Android native switch).
- `CHECKBOX` — the square-with-checkmark form.
- **Protocol**: a leaf node; the checked state is the semantic `SELECTED`
  (0x2004, U8 0/1) property, emitted guest→host and reported back host→guest.
- **Events**: a user toggle emits `VALUE_CHANGED` (0x06) with `B` = 0/1; the app
  writes it into its bound state. The renderer resolves hit-testing on its own
  native control.
- **Renderer mapping**: GTK `GtkSwitch`/`GtkCheckButton`; HTML `<input
  type="checkbox">`/`<input type="checkbox">` styled as a switch; ngui toggle.

### Slider — ✅ `SLIDER` 0x000E

A continuous numeric control within a range.

- **Protocol**: a leaf node with `VALUE` (0x2006, F32), `MIN_VALUE` (0x2007),
  `MAX_VALUE` (0x2008). The renderer resolves the semantic value from its own
  track geometry when the thumb is dragged.
- **Events**: `VALUE_CHANGED` (0x06, `A=targetId, B=value (f32)`).
- **Renderer mapping**: GTK `GtkScale`; HTML `<input type="range">`; ngui slider.

### Stepper — 🚧 `STEPPER` 0x0018

A control with − / + buttons that step a numeric value.

- **Protocol**: a leaf node with `VALUE` and `STEP_VALUE` (🚧 0x2009, F32 — the
  increment per press; default 1.0 if absent). `MIN_VALUE`/`MAX_VALUE` bound the
  stepping range.
- **Events**: `VALUE_CHANGED` (0x06) with the new value after each press.

### Picker — 🚧 `PICKER` 0x0019

A selection control among a fixed set of options.

- **Protocol**: a leaf node whose options are `STRING` entries. The selected
  index is `SELECTION` (🚧 0x2010, U32); the presentation is `PICKER_STYLE`
  (🚧 0x2014, ENUM: `Menu`=0, `Segmented`=1, `Wheel`=2, `RadioGroup`=3).
- **Events**: `VALUE_CHANGED` with `B` = the new selected index.
- **Renderer mapping**: GTK `GtkComboBoxText`/`GtkDropDown`; HTML `<select>` /
  segmented buttons; ngui picker.

### DatePicker — 🚧 `DATE_PICKER` 0x001A

A date/time selection control.

- **Protocol**: a leaf node with `DATE_VALUE` (🚧 0x2011, F32 — **unix seconds**
  since epoch) and `DATE_PICKER_MODE` (🚧 0x2013, ENUM: `Date`=0, `Time`=1,
  `DateAndTime`=2).
- **Events**: `VALUE_CHANGED` with `B` = the new unix seconds.
- **Renderer mapping**: GTK `GtkCalendar`/`GtkSpinButton`; HTML `<input
  type="date">`/`<input type="time">`; ngui date picker.

### ColorPicker — 🚧 `COLOR_PICKER` 0x001B

A color selection control.

- **Protocol**: a leaf node with `COLOR_VALUE` (🚧 0x2012, COLOR — packed
  `0xAARRGGBB`, sRGB).
- **Events**: `VALUE_CHANGED` — the value field carries the packed color
  **as an f32 bit pattern** of `0xAARRGGBB` (the app reinterprets it).
- **Renderer mapping**: GTK `GtkColorButton`; HTML `<input type="color">`; ngui
  color picker.

### ProgressView — 🚧 `PROGRESS_VIEW` 0x001C

Determinate or indeterminate progress.

- **Protocol**: a leaf node. Determinate: `PROGRESS` (🚧 0x200E, F32 0.0–1.0
  fraction, or 0.0–`MAX_VALUE` if `MAX_VALUE` is set). Indeterminate:
  `IS_INDETERMINATE` (🚧 0x200F, U8 1) — the renderer animates an activity
  indicator.
- **Events**: none.
- **Renderer mapping**: GTK `GtkProgressBar`/`GtkSpinner`; HTML `<progress>`/
  `<div class="spinner">`; ngui progress.

### Gauge — 🚧 `GAUGE` 0x001D

A value shown against a scale (SwiftUI `Gauge`).

- **Protocol**: a leaf node with `VALUE`, `MIN_VALUE`, `MAX_VALUE` (same IDs as
  Slider). The gauge style (linear/circular) is renderer/token-owned.
- **Events**: none (read-only; a gauged control that accepts input is a
  Slider).

### Menu — 🚧 `MENU` 0x001E

A pop-up menu of commands.

- **Protocol**: a leaf node with a label (SET_TEXT) and its items as `STRING`
  options (same option encoding as Picker). Selected item index is `SELECTION`
  (0x2010).
- **Events**: `VALUE_CHANGED` with `B` = the chosen item index.
- **Renderer mapping**: GTK `GtkMenuButton`; HTML `<div role="menu">`; ngui menu.

### Link — 🚧 mapped to `BUTTON`

SwiftUI `Link` is `BUTTON` with an associated URL; the app handles the tap and
opens the URL. No separate component.

---

## 5. Shapes & Paints

| View | Component | Status | Properties | Emits |
|------|-----------|--------|------------|-------|
| `Circle`, `Rectangle`, `RoundedRectangle`, `Capsule`, `Ellipse`, `Path` | `SHAPE` 0x0016 | 🚧 | SHAPE_KIND, COLOR, BACKGROUND_COLOR, BORDER_* | — |
| `Color` | (property value) | ✅ | — | — |
| `Gradient` | (property value) | 🚧 | — | — |

### Shapes — 🚧 `SHAPE` 0x0016 + `SHAPE_KIND` 0x0006

All SwiftUI shape views map to a **single** `SHAPE` component; the shape is an
`ENUM` property `SHAPE_KIND` (🚧 0x0006):

| SHAPE_KIND | Value |
|------------|-------|
| `Circle` | 0 |
| `Rectangle` | 1 |
| `RoundedRectangle` | 2 |
| `Capsule` | 3 |
| `Ellipse` | 4 |
| `Path` | 5 |

- **Properties**: fill = `COLOR`/`BACKGROUND_COLOR`; stroke = `BORDER_WIDTH`,
  `BORDER_COLOR`, `BORDER_RADIUS` (RoundedRectangle corner radius),
  `BORDER_EDGES`. `WIDTH`/`HEIGHT` size the shape's bounds.
- **Renderer mapping**: GTK/HTML/CSS drawing (CSS `border-radius`,
  `clip-path`, or inline SVG for `Path`). The renderer owns rendering; the
  shape kind is data, never a visual rule.

### Color — ✅ (property value)

SwiftUI `Color` is **not a component**: it is the `COLOR` value type
(`0xAARRGGBB`, sRGB) carried by `COLOR`, `BACKGROUND_COLOR`, `BORDER_COLOR`,
and other color-valued properties.

### Gradient — 🚧 (property value)

A gradient is a **draft** `DESIGN_TOKEN`-referenced or serialized value
(linear/radial stops). For now gradients are expressed as a `DESIGN_TOKEN`
property value; a dedicated gradient encoding is future work.

---

## 6. Navigation & Containers

| View | Component | Status | Properties | Emits |
|------|-----------|--------|------------|-------|
| `NavigationStack` | `NAVIGATION_STACK` 0x0020 | 🚧 | SELECTION (path index) | — |
| `NavigationSplitView` | `NAVIGATION_SPLIT_VIEW` 0x0021 | 🚧 | SELECTION | — |
| `TabView` | `TAB_VIEW` 0x0022 | 🚧 | SELECTION | `VALUE_CHANGED` |

> Navigation is **declarative**: the app holds the navigation state and emits
> the current structure; the renderer shows it. There is no imperative
> `push`/`pop` in the protocol.

### NavigationStack — 🚧 `NAVIGATION_STACK` 0x0020

A stack of destination views with back navigation.

- **Protocol**: a container whose children are the destination views, back to
  front. The visible destination is the last child; the renderer owns the
  transition animation.
- **Properties**: `SELECTION` (depth index) for programmatic control.
- **Renderer mapping**: GTK `GtkStack`; HTML stacked sections; ngui navigation.

### NavigationSplitView — 🚧 `NAVIGATION_SPLIT_VIEW` 0x0021

A master–detail split (sidebar + content).

- **Protocol**: a container with **two** children: the sidebar and the detail.
  `SELECTION` carries the selected sidebar row.
- **Renderer mapping**: GTK `GtkPaned`; HTML two-column responsive layout.

### TabView — 🚧 `TAB_VIEW` 0x0022

A tab bar switching among content children.

- **Protocol**: a container whose children are the tab pages. `SELECTION`
  (U32 index) is the active tab.
- **Events**: `VALUE_CHANGED` with `B` = the newly selected tab index.
- **Renderer mapping**: GTK `GtkNotebook`; HTML tab bar + panels; ngui tabs.

---

## Reserved component type IDs

For a renderer to be future-proof, the following component type ranges are
reserved:

| Range | Use |
|-------|-----|
| `0x0001`–`0x000E` | Implemented primitives (this file) |
| `0x000F`–`0x0022` | Draft-allocated primitives (this file) |
| `0x0023`–`0x00FF` | Future primitives (unallocated) |
| `0x0100`–`0xFFFF` | Application/custom component types |

A renderer MUST handle an unknown component type by rendering a blank node and
continuing — it must not crash or stop decoding.

---

## Conformance

Each primitive's opcode footprint is covered by the golden vectors in
[CONFORMANCE.md](./CONFORMANCE.md). New primitives added here MUST add vectors
before implementation lands in any renderer.