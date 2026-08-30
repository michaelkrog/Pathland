# Pathland DSL Authoring Contract

**Wire protocol version:** 1
**Status:** Draft
**Last Updated:** August 30, 2026

---

## Purpose

This document defines the **authoring surface** — the SwiftUI-shaped DSL an
application developer writes — for every Pathland implementation. Where
[PRIMITIVES.md](./PRIMITIVES.md), [MODIFIERS.md](./MODIFIERS.md), and
[EVENTS.md](./EVENTS.md) describe the **wire surface** (component types,
property ids, events, opcodes), this file describes the **surface in source
code**: how views, controls, modifiers, and state are *named*, *ordered*, and
*composed* so that any language can expose a conformant, idiomatic DSL.

A DSL in a new language is **conformant** when it:

1. exposes the full surface catalogued here (views, controls, modifiers,
   signals, state);
2. maps every DSL element to the exact protocol component/property/event
   documented in the companion specs (no re-interpretation, no reallocation);
3. produces **byte-identical opcode output** for the same source tree as the
   reference implementations (see the [Generation
   contract](#8-generation-contract-for-a-new-language)).

### Relationship to the other specs

| File | Role |
|------|------|
| [OPCODE.md](./OPCODE.md) | Wire format: categories, commands, 16-byte opcode layout, ring/arena, value types |
| [PRIMITIVES.md](./PRIMITIVES.md) | Which **views/nodes** exist and their component ids |
| [MODIFIERS.md](./MODIFIERS.md) | Which **modifiers** (properties) exist and how they encode |
| [EVENTS.md](./EVENTS.md) | Which **core events** (raw inputs) exist and how they encode |
| [CONFORMANCE.md](./CONFORMANCE.md) | Golden byte vectors |
| **DSL.md** (this file) | How an application **author** composes those into source code |

> **Implementation status** is tracked per implementing project (a `status.md`
> in each protocol crate/library), **not** in this specification. The Java DSL
> (`com.pathland.view`) and the Rust DSL (`pathland-view`) are the two reference
> realizations and are cited here by their **current signatures**; where they
> diverge from the canonical form below, that divergence is noted as a *delta*,
> and [§7](#7-java-convergence-proposal) proposes how the Java DSL converges.
> This document defines the contract only.

### Two guiding rules

1. **Stay as close to SwiftUI as possible.** View names, modifier names, and
   signature shapes mirror SwiftUI. Adapt only where the host language forces
   it (Rust snake_case + macros; Java camelCase + static factories), and never
   in a way that reorders or renames the canonical parameters.
2. **State variables are signals.** Pathland does **not** use SwiftUI's
   `@State`/`@Binding` property wrappers. The view syntax is SwiftUI; the
   reactivity model is Angular-style signals (writable signals, computeds,
   effects, two-way bindings). A generated DSL MUST expose the signal surface
   of [§3](#3-state-model-signals).

---

## 1. Design principles (DSL-flavored)

These recap the protocol's non-negotiables in author-facing terms. A conformant
DSL must be *shaped* by them:

- **Declarative structure, never positions.** The DSL expresses `WHAT` — a
  `VStack`, a `HStack`, a `Text` — and constraint properties (spacing, padding,
  alignment, size hints). It never computes bounds and never emits rects.
- **`body()` is evaluated once at mount.** A composite view declares its
  subtree once; reactivity comes from **signals**, never from re-evaluating the
  body. This is what lets the emitter produce fine-grained
  `SET_TEXT`/`SET_PROPERTY`/`SET_DATE` deltas instead of rebuilding the tree.
- **Modifiers are decoupled from views.** Any modifier applies to any view
  (`.padding` works on a `Text` and a `VStack` alike). A modifier a given
  renderer cannot apply is **allowed and ignored** — the property is still
  emitted.
- **Constructor properties vs modifiers.** Structural/layout parameters
  (`alignment`, `spacing`) are **constructor arguments**, never chainable.
  Everything decorative (padding, color, font, frame, border, …) is a
  **chainable modifier**. There is no standalone width/height — use the
  compound `frame` modifier.
- **`Color` is never a modifier.** `Color` has SwiftUI's dual identity: it is a
  **View** (a layout-greedy solid-color fill) and a **Data Type** (passed into
  style-taking modifiers: `.foregroundStyle`, `.background`, `.border`,
  `.tint`). There is **no** `.color()` modifier, and `.foregroundColor(_:)` is
  deprecated — foreground styling is always `.foregroundStyle(_:)`.
- **Only changes are transmitted.** Emission is diff-based; an unchanged tree
  emits **zero** opcodes. The DSL describes values; the emitter diffs them.
- **Typed enums, never raw ints.** Every enumerated value is a typed constant
  (`Alignment.leading`, `FontWeight.bold`, `ToggleStyle.checkbox`), not a bare
  integer. The numeric code is the DSL's job to resolve (see the value-type and
  enum tables in MODIFIERS.md).

---

## 2. Canonical signature notation

The canonical signatures below are written SwiftUI-shaped and language
agnostic. Conventions used:

- `T("…")` / `View("…")` — a view/control constructor.
- `{ ... }` — the child subtree (a trailing closure in SwiftUI; a vararg,
  macro, builder, or lambda in other languages).
- `Signal<T>` — a read-only derived or writable signal; `WritableSignal<T>` —
  a two-way binding target. A control takes a `WritableSignal<T>` for its
  value (see [§3](#3-state-model-signals)).
- `()` — the action a `Button` fires.
- Modifiers chain as `.name(args)` on any view and are applied
  **innermost-first** (the last chained modifier's property wins).

Per-language adaptation rules:

| Language | Case | Composition mechanism | Example |
|----------|------|-----------------------|---------|
| SwiftUI | `camelCase` | trailing closures + result builder | `VStack { Text("x").padding() }` |
| Java (`com.pathland.view`) | `camelCase` | static factories + varargs + chainable default methods | `View.vstack(View.text("x").padding(16))` |
| Rust (`pathland-view`) | `snake_case` | macros + free functions + chainable trait methods | `vstack![text("x").padding(16.0)]` |

---

## 3. State model (signals)

Pathland state is **Angular-style signals**. This is the non-negotiable
reactive core every DSL exposes.

### 3.1 Signal surface

| Canonical | Java DSL (`com.pathland.view.signal`) | Semantics |
|-----------|--------------------------------------|-----------|
| `signal(initial)` | `Signals.signal(T)` | a writable signal |
| `signal(name, initial)` | `Signals.signal(String, T)` | named (names surface in dependency errors) |
| `signal(initial, equal)` | `Signals.signal(T, BiPredicate<T,T>)` | custom equality |
| `computed(fn)` | `Signals.computed(Supplier<T>)` | lazy, memoized derived signal |
| `effect(fn)` | `Signals.effect(Runnable)` | runs immediately, then on dependency change |
| `untracked(fn)` | `Signals.untracked(Supplier<T>)` | reads without recording dependencies |
| `read()` | `get()` | current value |
| `write(v)` | `set(T)` | replace (no-op when equal) |
| `update(fn)` | `update(UnaryOperator<T>)` | derive from current and write |
| `asReadonly()` | `asReadonly()` | read-only view of a writable signal |

**Guarantees** (must be preserved by any implementation): equality suppression,
synchronous flush at the end of the outermost write, glitch-free propagation
(each computed recomputes at most once per flush), error caching, write
discipline, and circular-dependency detection.

### 3.2 Two-way binding

A control's value is **a `WritableSignal<T>` passed to its constructor**:
`TextField(placeholder, writable)`, `Toggle(label, isOn: writable)`,
`Slider(value: writable, in: min...max)`. The flow:

1. At **mount**, the DSL control records a **value input** (a sink on the
   retained node) for the signal, and the emitter exposes routing registries to
   the host: tap actions, text inputs, value inputs, date inputs.
2. The host receives the control's raw event (`TEXT_CHANGED`,
   `VALUE_CHANGED`, `DATE_CHANGED`, or a composed tap) and calls the sink,
   which **writes into the signal**.
3. The signal flush re-emits **only that node's** delta (`SET_TEXT`,
   `SET_PROPERTY`, `SET_DATE`) back through the emitter.

Reading is equally fine-grained: a node's text or a property can be **bound to
a signal** (`Text(signal)`, `.foregroundStyle(signal)`, `.fontSize(signal)`),
so a change re-emits only the bound node.

### 3.3 Persisted state (`State<T>`)

A `State<T>` field is the SwiftUI-`@State`-shaped form of a persisted signal,
**auto-wired by key**:

```java
State<Integer> count = new State<>(0);            // key = field name "count"
State<Integer> total = new State<>(0, "total");   // explicit store key
count.get(); count.set(0); count.update(v -> v + 1);
count.signal();                                   // the WritableSignal (for TextField, …)
```

The store (`StateStore`) is untyped and platform-neutral (in-memory, Redis,
file, SQLite, LocalStorage, NVS flash). The Java realization wires `State`
fields via an annotation processor that generates a `<View>_StateBinder` per
view class; connection happens when the view renders. A generated DSL in a
language without reflection/annotation processing MUST offer the equivalent
explicit wiring.

---

## 4. View surface

Component ids and wire behavior come from
[PRIMITIVES.md](./PRIMITIVES.md); the tables here give the **DSL signature**.
`Java DSL (current)` is the reference realization today.

### 4.1 Primitive drawing & visual nodes

| View | Canonical (SwiftUI-shaped) | Java DSL (current) | Emits / Binds |
|------|---------------------------|--------------------|---------------|
| `Text` | `Text("…")` / `Text(Signal<String>)` | `View.text(String)` / `View.text(Signal<String>)` | `TEXT` 0x01; content `SET_TEXT` |
| `Image` | `Image("name")` / `Image(systemName:)` | `View.image()` / `View.image(String source)` | `IMAGE` 0x02; `IMAGE_SOURCE` 0x1002 |
| `Color` | `Color(.sRGB, red:green:blue:)` (a View) | `Color.rgb(int,int,int)` (implements `View`) | `COLOR` 0x03; `COLOR` 0x100A |
| `Shape` | `Rectangle()`, `Circle()`, `Capsule()`, `RoundedRectangle(cornerRadius:)` | `View.rectangle()` | `SHAPE` 0x04; `SHAPE_KIND` 0x0006 |
| `Divider` | `Divider()` | `View.divider()` | `DIVIDER` 0x05 |
| `Spacer` | `Spacer()` | `View.spacer()` | `SPACER` 0x06 |
| `ProgressView` | `ProgressView(value:)` / `ProgressView()` | `View.progressView(float)` / `View.progressView()` | `PROGRESS_VIEW` 0x07; `PROGRESS` 0x200E / `IS_INDETERMINATE` 0x200F |
| `Gauge` | `Gauge(value:in:)` | `View.gauge(float value, float min, float max)` | `GAUGE` 0x08; `VALUE`/`MIN_VALUE`/`MAX_VALUE` |

**Deltas (Java)**: primitives are constructed via the `View.` static factory
(`View.text("…")`) rather than direct construction (`Text("…")`). Shape kinds
other than `Rectangle` are not exposed as named constructors in the Java DSL
today (only `View.rectangle()`); the canonical form exposes the full
`ShapeKind` set.

### 4.2 Layout & container nodes

| View | Canonical (SwiftUI-shaped) | Java DSL (current) | Emits / Binds |
|------|---------------------------|--------------------|---------------|
| `VStack` | `VStack(alignment:spacing:) { … }` | `View.vstack(View...)` / `View.vstack(Alignment, float, View...)` | `VSTACK` 0x10; `SPACING` 0x0001, `ALIGNMENT` 0x0002, `CONTENT_MARGINS` 0x0005 |
| `HStack` | `HStack(alignment:spacing:) { … }` | `View.hstack(View...)` / `View.hstack(Alignment, float, View...)` | `HSTACK` 0x11 |
| `ZStack` | `ZStack(alignment:) { … }` | `View.zstack(View...)` | `ZSTACK` 0x12; `ALIGNMENT` |
| `Grid` | `Grid(alignment:horizontalSpacing:verticalSpacing:) { … }` | `View.grid(View...)` | `GRID` 0x13 |
| `ScrollView` | `ScrollView { … }` | `View.scrollView(View...)` | `SCROLLVIEW` 0x14 |
| `LazyVGrid` | `LazyVGrid(columns:alignment:spacing:) { … }` | `View.lazyVGrid(View...)` | `LAZY_VGRID` 0x15 |
| `LazyHGrid` | `LazyHGrid(rows:alignment:spacing:) { … }` | `View.lazyHGrid(View...)` | `LAZY_HGRID` 0x16 |
| `LazyVStack` | `LazyVStack(alignment:spacing:) { … }` | `View.lazyVStack(View...)` | `LAZY_VSTACK` 0x1B |
| `LazyHStack` | `LazyHStack(alignment:spacing:) { … }` | `View.lazyHStack(View...)` | `LAZY_HSTACK` 0x1C |

**Deltas (Java)**: stacks are constructed with the `View.vstack(...)` factory
using varargs (`View.vstack(children...)`), not a builder/trailing-closure
block. Constructor layout properties come as a separate overload
(`View.vstack(Alignment, float, View...)`). The canonical SwiftUI form passes
`alignment`/`spacing` as labeled constructor arguments inside the braces' call.

### 4.3 Semantic controls

Two-way value controls bind a `WritableSignal`. Actions bind a callback.

| Control | Canonical (SwiftUI-shaped) | Java DSL (current) | Emits / Binds |
|---------|---------------------------|--------------------|---------------|
| `Button` | `Button("title", action)` / `Button(action:label:)` | `View.button(String, Runnable)` / `View.button(View, Runnable)` | `BUTTON` 0x20; tap = composed `POINTER_DOWN`+`POINTER_UP` |
| `TextField` | `TextField("placeholder", text: writable)` | `View.textField(String, WritableSignal<String>)` | `TEXT_FIELD` 0x21; `TEXT_CHANGED` → text input |
| `SecureField` | `SecureField("…", text: writable)` | (secure via `IS_SECURE` token) | `TEXT_FIELD` 0x21 + `IS_SECURE` 0x200D |
| `TextEditor` | `TextEditor(text: writable)` | `View.textEditor(WritableSignal<String>)` | `TEXT_EDITOR` 0x22 |
| `Toggle` | `Toggle("label", isOn: writable)` | `View.toggle(boolean, WritableSignal<Boolean>)` / `View.toggle(ToggleStyle, boolean, WritableSignal<Boolean>, String)` | `TOGGLE` 0x24; `VALUE_CHANGED` → value input; `TOGGLE_STYLE` 0x2018 |
| `Slider` | `Slider(value: writable, in: min...max)` | `View.slider(float value, float min, float max, WritableSignal<Float>)` | `SLIDER` 0x25; `VALUE_CHANGED` → value input |
| `Stepper` | `Stepper("label", value: writable, in: min...max, step:)` | `View.stepper(float, float, float, float, WritableSignal<Float>)` | `STEPPER` 0x26; `VALUE_CHANGED` → value input |
| `DatePicker` | `DatePicker("label", selection: writable, displayedComponents:)` | `View.datePicker(DatePickerMode, WritableSignal<Integer>)` | `DATE_PICKER` 0x27; `DATE_CHANGED` → date input; value via `STYLE::SET_DATE` |
| `Picker` | `Picker("label", selection: writable) { options }` | `View.picker(PickerStyle, WritableSignal<Integer>, View... options)` | `PICKER` 0x28; `VALUE_CHANGED` (index) → value input |
| `Menu` | `Menu { actions } label: { trigger }` | `View.menu(View trigger, View... actions)` / `View.menu(View, WritableSignal<Integer>, View...)` | `MENU` 0x29; `VALUE_CHANGED` (item index) → value input |
| `ColorPicker` | `ColorPicker("label", selection: writable)` | `View.colorPicker(WritableSignal<Color>)` | `COLOR_PICKER` 0x2A; `VALUE_CHANGED` (packed `0xAARRGGBB` as f32) → value input |

**Deltas (Java)**: the value binding is a positional constructor argument
(`View.slider(value, min, max, binding)`) instead of SwiftUI's labeled
`value:in:` range binding. `Button` takes a `(label, action)` pair rather than
SwiftUI's `Button("title") { action }` trailing-action form. `Toggle` takes
`(style, selected, binding, label)` positionally; `DatePicker` binds
**days-since-epoch** (`WritableSignal<Integer>`) rather than a date object —
the protocol's `SET_DATE`/`DATE_CHANGED` two-field encoding is
days + millis-of-day (see [§7](#7-java-convergence-proposal)).

**Control guarantees** (from PRIMITIVES.md): a control without children renders
in **Native Token Mode** (native OS control); a control with a child subtree
renders in **Composite Override Mode** (custom chrome wrapped with native
gesture semantics). Renderers MUST gate value/text/date events by
`BINDING_ID`, `ACTION_ID`, or the `EVENT_LISTENERS` bitmask (transport-aware
event guards) — see [EVENTS.md](./EVENTS.md).

### 4.4 Gestures

| Gesture | Canonical (SwiftUI-shaped) | Java DSL (current) | Rust DSL (current) |
|---------|---------------------------|--------------------|--------------------|
| tap | `.onTapGesture { action }` | `.onTapGesture(Runnable)` | `.on_tap_gesture(f)` |
| raw pointer | `.gesture` composition from raw inputs | `.pointerEvents(int mask)` | `.pointer_events(u32 mask)` |

Tap is **not** a protocol event: it is composed app-side from `POINTER_DOWN`
then `POINTER_UP` on the same target (`EVENT_LISTENERS` bits 0|2). The DSL's
`.onTapGesture` declares those listeners and records the action; the host
routes the recognized tap via the emitter's tap-action registry.

---

## 5. Modifier surface

Properties, value types, and emission rules come from
[MODIFIERS.md](./MODIFIERS.md); the tables here give the **DSL signature**. A
compound SwiftUI modifier expands to **one `SET_PROPERTY` per underlying
property** (`.frame` → `WIDTH` + `HEIGHT` + `ALIGNMENT`; `.border` →
`BORDER_COLOR` + `BORDER_WIDTH`; `.shadow` → `SHADOW_COLOR` + `SHADOW_RADIUS` +
`SHADOW_X` + `SHADOW_Y`). `Java DSL (current)` is the reference realization.

### 5.1 Layout & frame

| Modifier | Canonical (SwiftUI-shaped) | Java DSL (current) | Property(ies) |
|----------|---------------------------|--------------------|---------------|
| `frame` | `.frame(width:height:alignment:)` | `.frame(float width, float height, Alignment)` | `WIDTH` 0x100B, `HEIGHT` 0x100C, `ALIGNMENT` 0x0002 |
| `frame(min:…)` | `.frame(minWidth:idealWidth:maxWidth:minHeight:idealHeight:maxHeight:)` | `.frame(float, float, float, float, float, float)` (NaN = unset) | `MIN_WIDTH` 0x0012 … `MAX_HEIGHT` 0x0017 |
| `padding` | `.padding(_:)` / `.padding(_:edges:)` | `.padding(int)` / `.padding(float)` / `.padding(int top, int right, int bottom, int left)` | `PADDING` 0x1011 / `PADDING_TOP` 0x1012 … `PADDING_LEFT` 0x1015 |
| `offset` | `.offset(x:y:)` | `.offset(float x, float y)` | `OFFSET_X` 0x000E, `OFFSET_Y` 0x000F |
| `position` | `.position(x:y:)` | `.position(float x, float y)` | `POSITION_X` 0x0010, `POSITION_Y` 0x0011 |
| `fixedSize` | `.fixedSize()` / `.fixedSize(horizontal:vertical:)` | `.fixedSize()` / `.fixedSize(boolean, boolean)` | `FIXED_SIZE_HORIZONTAL` 0x0018, `FIXED_SIZE_VERTICAL` 0x0019 |
| `layoutPriority` | `.layoutPriority(_:)` | `.layoutPriority(float)` | `LAYOUT_PRIORITY` 0x001A |
| `zIndex` | `.zIndex(_:)` | `.zIndex(float)` | `Z_INDEX` 0x100F |
| `aspectRatio` | `.aspectRatio(_:contentMode:)` | `.aspectRatio(float, ContentMode)` | `ASPECT_RATIO` 0x001B, `CONTENT_MODE` 0x001C |
| `scaledToFit` | `.scaledToFit()` | `.scaledToFit()` | `CONTENT_MODE` 0x001C (Fit) |
| `scaledToFill` | `.scaledToFill()` | `.scaledToFill()` | `CONTENT_MODE` 0x001C (Fill) |
| `minimumScaleFactor` | `.minimumScaleFactor(_:)` | `.minimumScaleFactor(float)` | `MINIMUM_SCALE_FACTOR` 0x001D |

**Semantics**: `WIDTH`/`HEIGHT` use the sentinels `FILL` (−1.0 = expand) and
`HUG_CONTENT` (−2.0 = intrinsic); omitting an axis leaves it to the native
renderer. `OFFSET` is a post-layout translation; `POSITION` is absolute
placement within the parent.

### 5.2 Text formatting

| Modifier | Canonical (SwiftUI-shaped) | Java DSL (current) | Property(ies) |
|----------|---------------------------|--------------------|---------------|
| `font` | `.font(.system(size:))` | `.fontSize(float)` / `.fontSize(Signal<Float>)` | `FONT_SIZE` 0x1007 |
| `fontWeight` | `.fontWeight(_:)` | `.fontWeight(FontWeight)` | `FONT_WEIGHT` 0x1008 (100–900) |
| `font` (custom) | `.font(.custom(name:size:))` | `.fontFamily(String)` | `FONT_FAMILY` 0x1009 |
| `fontStyle` | `.italic()` / `.fontDesign(_:)` | `.italic()` / `.fontStyle(FontStyle)` / `.fontDesign(FontDesign)` | `FONT_STYLE` 0x1017, `FONT_DESIGN` 0x1018 |
| `fontWidth` | `.fontWidth(_:)` | `.fontWidth(float)` | `FONT_WIDTH` 0x1019 |
| `kerning` | `.kerning(_:)` | `.kerning(float)` | `KERNING` 0x101A |
| `tracking` | `.tracking(_:)` | `.tracking(float)` | `TRACKING` 0x101B |
| `baselineOffset` | `.baselineOffset(_:)` | `.baselineOffset(float)` | `BASELINE_OFFSET` 0x101C |
| `lineSpacing` | `.lineSpacing(_:)` | `.lineSpacing(float)` | `LINE_SPACING` 0x101D |
| `lineLimit` | `.lineLimit(_:)` | `.lineLimit(int)` | `LINE_LIMIT` 0x000B (0 = unlimited) |
| `multilineTextAlignment` | `.multilineTextAlignment(_:)` | `.multilineTextAlignment(TextAlignment)` | `TEXT_ALIGNMENT` 0x000C |
| `truncationMode` | `.truncationMode(_:)` | `.truncationMode(Truncation)` | `TRUNCATION_MODE` 0x000D |
| `textCase` | `.textCase(_:)` | `.textCase(TextCase)` | `TEXT_CASE` 0x101E |
| `underline` | `.underline()` | `.underline()` / `.underline(boolean)` | `UNDERLINE` 0x101F |
| `strikethrough` | `.strikethrough()` | `.strikethrough()` / `.strikethrough(boolean)` | `STRIKETHROUGH` 0x1020 |
| `foregroundStyle` | `.foregroundStyle(_:)` | `.foregroundStyle(Color)` / `.foregroundStyle(Signal<Color>)` | `COLOR` 0x100A |
| `tint` | `.tint(_:)` | `.tint(Color)` | `TINT` 0x1030 |

> **`Color` is never a modifier** — there is no `.color()` and
> `.foregroundColor(_:)` is deprecated. Foreground styling is
> `.foregroundStyle(_:)`.

### 5.3 Appearance & effects

| Modifier | Canonical (SwiftUI-shaped) | Java DSL (current) | Property(ies) |
|----------|---------------------------|--------------------|---------------|
| `background` | `.background(_:)` | `.background(Color)` / `.background(Signal<Color>)` | `BACKGROUND_COLOR` 0x1001 |
| `border` | `.border(_:width:)` | `.border(float width, Color color, float radius)` | `BORDER_COLOR` 0x1004, `BORDER_WIDTH` 0x1003, `BORDER_RADIUS` 0x1005 |
| `border` (edges) | `.border(_:width:edges:)` | (not exposed) | + `BORDER_EDGES` 0x1016 (u32 bitmask: `TOP`=1, `LEADING`=2, `BOTTOM`=4, `TRAILING`=8) |
| `cornerRadius` | `.cornerRadius(_:)` | `.cornerRadius(float)` | `BORDER_RADIUS` 0x1005 |
| `shadow` | `.shadow(color:radius:x:y:)` | `.shadow(Color, float, float, float)` / `.shadow(float)` | `SHADOW_COLOR` 0x1021, `SHADOW_RADIUS` 0x1022, `SHADOW_X` 0x1023, `SHADOW_Y` 0x1024 |
| `opacity` | `.opacity(_:)` | `.opacity(float)` | `OPACITY` 0x100D |
| `blur` | `.blur(radius:)` | `.blur(float)` | `BLUR_RADIUS` 0x1025 |
| `saturation` | `.saturation(_:)` | `.saturation(float)` | `SATURATION` 0x1026 |
| `contrast` | `.contrast(_:)` | `.contrast(float)` | `CONTRAST` 0x1027 |
| `brightness` | `.brightness(_:)` | `.brightness(float)` | `BRIGHTNESS` 0x1028 |
| `grayscale` | `.grayscale(_:)` | `.grayscale(float)` | `GRAYSCALE` 0x1029 |
| `hueRotation` | `.hueRotation(_:)` | `.hueRotation(float)` | `HUE_ROTATION` 0x102A |
| `colorMultiply` | `.colorMultiply(_:)` | `.colorMultiply(Color)` | `COLOR_MULTIPLY` 0x102B |
| `colorInvert` | `.colorInvert()` | `.colorInvert()` | `COLOR_INVERT` 0x102C |
| `clipped` | `.clipped()` | `.clipped()` | `CLIPS_TO_BOUNDS` 0x1010 |
| `clipShape` | `.clipShape(_:)` | `.clipShape(ShapeKind)` | `CLIPS_TO_BOUNDS` 0x1010 + `SHAPE_KIND` 0x0006 |

**Delta (Java)**: `.border` takes `(width, color, radius)` — SwiftUI's
parameter order is `.border(color, width)` and corner radius is a separate
`.cornerRadius`. The canonical order MUST be color-then-width.

### 5.4 Transform

| Modifier | Canonical (SwiftUI-shaped) | Java DSL (current) | Property(ies) |
|----------|---------------------------|--------------------|---------------|
| `rotationEffect` | `.rotationEffect(_:anchor:)` | `.rotation(float)` | `ROTATION_DEGREES` 0x102D |
| `scaleEffect` | `.scaleEffect(_:anchor:)` | `.scaleEffect(float)` | `SCALE` 0x102E |

Anchor is renderer-token-owned (center default); the protocol does not transmit
anchors. Transforms do not affect layout.

### 5.5 Interaction & state

| Modifier | Canonical (SwiftUI-shaped) | Java DSL (current) | Property(ies) |
|----------|---------------------------|--------------------|---------------|
| `hidden` | `.hidden()` | `.hidden()` / `.visible(boolean)` | `VISIBLE` 0x100E |
| `disabled` | `.disabled(_:)` | `.disabled(boolean)` | `ENABLED` 0x2003 (inverse: 1 = interactive) |
| `allowsHitTesting` | `.allowsHitTesting(_:)` | `.allowsHitTesting(boolean)` | `ALLOWS_HIT_TESTING` 0x102F |
| `controlSize` | `.controlSize(_:)` | `.controlSize(ControlSize)` | `CONTROL_SIZE` 0x200C |
| `accessibilityLabel` | `.accessibilityLabel(_:)` | `.accessibilityLabel(String)` | `LABEL` 0x200A |
| `accessibilityRole` | `.accessibilityRole(_:)` | `.accessibilityRole(int)` | `ROLE` 0x2001 |
| `accessibilityState` | `.accessibilityState(_:)` | `.accessibilityState(int)` | `STATE` 0x2002 |
| `modifier` (custom) | `.modifier(_:)` | `.modifier(ViewModifier)` | composes core modifiers |
| `buttonStyle` | `.buttonStyle(_:)` | `.buttonStyle(ButtonStyle)` | environment-scoped (ScopedValue) |
| `focusable` | `.focusable(_:)` | (via `.pointerEvents`) | **no property** — declares `FOCUS` listener bit 5; observe `FOCUS_CHANGED` |
| raw listeners | `.pointerEvents(mask)` / `.pointer_events(mask)` | `.pointerEvents(int)` | `EVENT_LISTENERS` 0x2005 (u32 bitmask, bits per EVENTS.md) |

**Delta (Java)**: `.visible(boolean)` is a Pathland extra (SwiftUI only has
`.hidden()`). `.accessibilityRole`/`.accessibilityState` take raw `int` codes
today rather than a typed enum. Raw input listeners are exposed only through
`.pointerEvents(mask)` — there is no per-event sugar (e.g. a `.focusable` or
`.onSubmit` that sets the matching bit).

---

## 6. Authoring conventions

A conformant DSL follows these conventions:

1. **Names**: SwiftUI view/modifier names; per-language case (camelCase,
   snake_case). `foregroundStyle` not `foregroundColor`; `fontWeight`,
   `multilineTextAlignment`, `scaledToFit`, `allowsHitTesting` keep their
   SwiftUI spellings.
2. **Signature order**: canonical parameter order is preserved —
   `.border(color, width)`, `.frame(width, height, alignment)`,
   `.shadow(color, radius, x, y)`. Compound modifiers expand to one property
   per argument.
3. **Constructor vs modifier**: structural (alignment, spacing) in the
   constructor; everything else chainable.
4. **Typed enums**: `Alignment` (leading/center/trailing/fill),
   `TextAlignment`, `FontWeight` (100–900), `Truncation` (head/middle/tail),
   `TextCase` (none/uppercase/lowercase), `FontStyle` (normal/italic),
   `FontDesign` (default/serif/rounded/monospaced), `ContentMode` (fit/fill),
   `ControlSize` (small/regular/large), `ToggleStyle`
   (switch/checkbox/button), `PickerStyle` (menu/segmented/wheel/radiogroup),
   `DatePickerMode` (date/time/dateAndTime), `ShapeKind`
   (circle/rectangle/roundedRectangle/capsule/ellipse/path). Numeric codes
   come from MODIFIERS.md's appendix; the DSL resolves them.
5. **`Spacer`/`Color` as views**: `Spacer()` is a flexible expanding filler;
   `Color(...)` in a tree is a layout-greedy fill.
6. **Environment scoping**: styles and state that must reach a whole subtree
   (`ButtonStyle`, the session's persisted state) are injected via the
   environment (Java: `ScopedValue`), never threaded through constructors.
7. **Reactivity discipline**: `body()` is evaluated once; a signal read during
   mount records a dependency; a later write re-emits only the bound node.
   Never mutate signals during mount.
8. **Emission contract**: each DSL call emits exactly the documented
   properties with the documented value types; the emitter diffs. The DSL never
   computes layout, never positions, never serializes full trees.

---

## 7. Java convergence proposal

The Java DSL (`com.pathland.view`) has the complete surface; its *syntax*
drifts from the canonical SwiftUI shape. This section proposes convergence as a
future workstream (out of scope for this document's landing). It is a
**proposal** — the canonical contract is defined in [§4](#4-view-surface) and
[§5](#5-modifier-surface), not here.

| Canonical | Java today | Proposed Java (SwiftUI-closer) |
|-----------|-----------|--------------------------------|
| `Text("…")` | `View.text(String)` / `View.text(Signal<String>)` | `Text.of(String)` / `Text.of(Signal<String>)` |
| `Button("…", action)` / `Button(action:label:)` | `View.button(String, Runnable)` / `View.button(View, Runnable)` | `Button.of(String, Runnable)` / `Button.of(View, Runnable)` |
| `Toggle("label", isOn: writable)` | `View.toggle(boolean, WritableSignal<Boolean>)` (+ `ToggleStyle` overload) | `Toggle.of(String label, WritableSignal<Boolean>)` (+ `ToggleStyle` overload) |
| `Slider(value: in:)` | `View.slider(value, min, max, binding)` | `Slider.of(binding, min, max)` keeping positional order: binding first |
| `.border(color, width)` | `.border(width, color, radius)` | add `.border(Color, float)`; keep `(width, color, radius)` as the corner-radius convenience |
| `DatePicker(selection:)` | `View.datePicker(DatePickerMode, WritableSignal<Integer>)` | `DatePicker.of(mode, days)` (optionally a `Date`-shaped overload encoding days + millis-of-day per `SET_DATE`/`DATE_CHANGED`) |

Guidance for the proposal:

- **`.of()` is the one construction path.** Every concrete view/control
  exposes a static `<ViewName>.of(...)` factory on its own class. Construction
  is never `new <ViewName>()` and never `View.<name>(...)`.
- **Remove the `View.*` static-factory surface.** Once the `.of()` factories
  land and `pathland-demo-views` + both demos migrate, delete the entire
  static-factory block in `View.java` — `text`, `image`, `rectangle`,
  `spacer`, `vstack`, `hstack`, `zstack`, `button`, `textField`,
  `textEditor`, `toggle`, `slider`, `stepper`, `progressView`, `gauge`,
  `divider`, `grid`, `scrollView`, `lazyVStack`, `lazyHStack`, `lazyVGrid`,
  `lazyHGrid`, `picker`, `menu`, `colorPicker`, `datePicker`, `group`. The
  chainable default modifiers on `View` stay. This is a deliberate, single
  breaking change — additive first (`.of()` factories), then removal.
- **`Group` becomes a first-class view.** `View.group(List<View>)` (which
  returned a `VStack`) is replaced by `Group.of(View...)`, a transparent
  container view (SwiftUI `Group`) that composites its children;
  `View.group(...)` is removed with the rest of the factories.
- Add a static `.of()` factory for each `ShapeKind` (`Circle.of()`,
  `Capsule.of()`, `RoundedRectangle.of(cornerRadius:)`) to match the
  canonical view set.
- Consider a `ButtonStyle`/`environment` path that lets the trailing-action
  form (`Button(label) { action }`) read the action from the environment, if a
  Java-idiomatic trailing lambda is desirable.
- Land the convergence only after the DSL.md surface is stable, and update
  `lib/java/pathland-view/status.md` in the same change.

---

## 8. Generation contract for a new language

An AI (or a human) generating a Pathland DSL in a new language MUST produce the
following and verify each item. This is a checklist; the authoritative details
are the companion specs.

### 8.1 Required surface

- [ ] **Views/controls** — every entry of [§4](#4-view-surface):
  `Text`, `Image`, `Color`, `Shape` (all `ShapeKind`s), `Divider`, `Spacer`,
  `ProgressView`, `Gauge`; `VStack`, `HStack`, `ZStack`, `Grid`, `ScrollView`,
  `LazyVGrid`, `LazyHGrid`, `LazyVStack`, `LazyHStack`; `Button`,
  `TextField`, `SecureField`, `TextEditor`, `Toggle`, `Slider`, `Stepper`,
  `Picker`, `Menu`, `DatePicker`, `ColorPicker`.
- [ ] **Modifiers** — every entry of [§5](#5-modifier-surface), chainable on
  any view, innermost-first, emitting one property per underlying argument.
- [ ] **Signals** — `signal`, `computed`, `effect`, `untracked`,
  `get`/`set`/`update`/`asReadonly`, with equality suppression, synchronous
  flush, glitch-free propagation, error caching, write discipline, circular
  detection ([§3.1](#31-signal-surface)).
- [ ] **Two-way bindings** — every value control takes a writable signal and
  exposes a sink the host routes its event into ([§3.2](#32-two-way-binding)).
- [ ] **Persisted state** — `State<T>` keyed fields (or the language's
  equivalent wiring) against a platform-neutral store ([§3.3](#33-persisted-state-statet)).
- [ ] **Gestures** — `.onTapGesture` (composed from raw pointer down/up) and
  raw `pointerEvents`/`EVENT_LISTENERS` bitmask ([§4.4](#44-gestures)).

### 8.2 Mapping rules (signature → protocol)

1. Each view/control maps to its **fixed component id** in PRIMITIVES.md.
   Application/custom component types live in `0x0100`–`0xFFFF`; a DSL must
   never reuse allocated ids.
2. Each modifier maps to the **documented property id(s)** in MODIFIERS.md
   with the documented **value type** (U8/U32/I32/F32/STRING/ENUM/COLOR/
   DESIGN_TOKEN). Enumerated values use the numeric codes in MODIFIERS.md's
   appendix.
3. `Color` values pack as sRGB `0xAARRGGBB`.
4. `WIDTH`/`HEIGHT` sentinels: `FILL` = −1.0, `HUG_CONTENT` = −2.0.
5. `DatePicker` value/event use the two-field encoding **days since epoch
   (I32) + millis of day (U32)**; there is no `DATE_VALUE` property.
6. Value/text/date events are gated by the transport-aware event guards; the
   DSL's controls emit the `ACTION_ID`/`BINDING_ID`/`EVENT_LISTENERS` that
   declare intent.
7. Emission is **diff-based and reactive**: the DSL describes values, the
   emitter diffs. A generated DSL must keep the retained tree + emitter
   separation; it must not hand-serialize full trees.

### 8.3 Language adaptation rules

| SwiftUI mechanism | Adapt as |
|-------------------|----------|
| trailing closure / result builder for children | varargs (Java), macros (Rust), builders/block (C#/Kotlin), element list (any) |
| `Binding<T>` (Swift) | `WritableSignal<T>` (always — signals are the model, never property wrappers) |
| `some View` opaque return | the language's `View` interface/trait (Java `View`, Rust `View` trait) |
| `@State`/`@Binding` property wrappers | signals + persisted `State<T>` ([§3.3](#33-persisted-state-statet)) |
| labeled parameters | named params where the language has them; otherwise preserve **parameter order** and document labels |
| method chaining for modifiers | default methods (Java), extension traits (Rust), extension methods (C#/Kotlin) |

### 8.4 Conformance recipe

A generated DSL is verified by proving it **emits the same bytes** as the
reference implementations:

1. Port the golden vectors in [CONFORMANCE.md](./CONFORMANCE.md) into the new
   DSL's test harness; assert byte-identical `TREE`/`STYLE`/`EVENT`/`META`
   opcodes for each canonical element.
2. Port the Java `EmitterTest` cases (mount → `SET_TEXT`/`SET_PROPERTY`/`SET_DATE`
   deltas; unchanged tree → zero opcodes; two-way routing: `TEXT_CHANGED`,
   `VALUE_CHANGED`, `DATE_CHANGED` write into the bound signal).
3. Verify the no-heap-allocation steady-state property where the target
   language supports it (the Rust engine proves zero dynamic allocations during
   steady-state emission).
4. Cross-check every referenced id against PRIMITIVES.md/MODIFIERS.md/EVENTS.md
   (the specs are the source of truth, never the reference code).

**Reference implementations to read**: Java — `lib/java/pathland-view`
(`com.pathland.view`, `com.pathland.view.signal`, `com.pathland.view.state`,
`com.pathland.view.emit`); Rust — `lib/rust/crates/pathland-view` +
`pathland-engine` + `pathland-core::signal`.

---

## 9. Appendix A: SwiftUI ↔ DSL signature map

Representative rows; the full surface is in [§4](#4-view-surface) and
[§5](#5-modifier-surface).

| SwiftUI | Canonical DSL | Java DSL (current) | Rust DSL (current) |
|---------|---------------|--------------------|--------------------|
| `Text("Hi")` | `Text("Hi")` | `View.text("Hi")` | `text("Hi")` |
| `VStack(alignment: .center, spacing: 8) { … }` | `VStack(alignment:spacing:) { … }` | `View.vstack(Alignment.CENTER, 8, children...)` | `vstack![…].spacing(8.0)` |
| `Button("+") { inc() }` | `Button("+", action)` | `View.button("+", () -> inc())` | `button("+")` (no action yet) |
| `TextField("Name", text: $name)` | `TextField("Name", text: writable)` | `View.textField("Name", name)` | `TextField { placeholder }` (no binding yet) |
| `Toggle("On", isOn: $on)` | `Toggle("On", isOn: writable)` | `View.toggle(selected, binding)` | `Toggle(style)` (no binding yet) |
| `Slider(value: $v, in: 0...100)` | `Slider(value: writable, in: min...max)` | `View.slider(v, 0, 100, vSig)` | `Slider { value, min, max }` (no binding yet) |
| `DatePicker("D", selection: $d)` | `DatePicker("D", selection: writable)` | `View.datePicker(DatePickerMode.DATE, days)` | `DatePicker` (bare) |
| `.foregroundStyle(.red)` | `.foregroundStyle(Color)` | `.foregroundStyle(Color)` | `.foreground_style(Color(0xFF0000FF))` |
| `.background(.gray)` | `.background(Color)` | `.background(Color)` | `.background(Color(0xFFEEEEEE))` |
| `.border(.blue, width: 2)` | `.border(Color, width: 2)` | `.border(2, Color, 8)` | `.border(Color, 2.0)` |
| `.frame(width: 100, height: 24)` | `.frame(width:height:alignment:)` | `.frame(100, 24, Alignment)` | `.frame(Some(100.0), Some(24.0), None)` |
| `.padding(16)` | `.padding(16)` | `.padding(16)` | `.padding(16.0)` |
| `.font(.system(size: 28))` | `.font(size: 28)` | `.fontSize(28)` | `.font_size(28.0)` |
| `.fontWeight(.bold)` | `.fontWeight(FontWeight)` | `.fontWeight(FontWeight.BOLD)` | `.font_weight(700.0)` |
| `.shadow(color:radius:x:y:)` | `.shadow(color:radius:x:y:)` | `.shadow(Color, float, float, float)` | (not yet) |
| `.onTapGesture { go() }` | `.onTapGesture(action)` | `.onTapGesture(() -> go())` | `.on_tap_gesture(|| go())` |

**Status deltas captured by this table**: the Java DSL is surface-complete but
uses static-factory syntax and a few non-SwiftUI parameter orders (see
[§7](#7-java-convergence-proposal)); the Rust DSL is structural today —
`pathland-view` exposes the view/modifier surface without signals, two-way
bindings, or actions (signals live in `pathland-core::signal` for engine-side
binding). Neither difference affects the protocol; both are per-project
implementation status tracked in each project's `status.md`.

---

## Conformance

- The wire footprint of every DSL element above is defined by the golden
  vectors in [CONFORMANCE.md](./CONFORMANCE.md). A new DSL element MUST add
  vectors before any implementation depends on it.
- Component ids: [PRIMITIVES.md](./PRIMITIVES.md); property ids and value
  types: [MODIFIERS.md](./MODIFIERS.md); event ids and listener bits:
  [EVENTS.md](./EVENTS.md). These specs are the single source of truth.