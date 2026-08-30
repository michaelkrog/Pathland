# pathland-view (Java) — implementation status

**Last updated:** August 30, 2026

The hand-written, framework-agnostic Java 25+ DSL (`com.pathland.view`):
SwiftUI-style views, Angular-style signals, fine-grained emitter, `PLPL` wire
codec, lazy FFM ring interop, and cross-platform `State`. Protocol contract:
`spec/`.

## Implemented

- **Construction is `.of()` only**: every concrete view/control exposes a
  static `<ViewName>.of(...)` factory (`Text.of`, `VStack.of`,
  `Button.of(label, action)`, `Slider.of(binding, min, max)`,
  `DatePicker.of(mode, days)`, …); constructors are private and the former
  `View.*` static-factory surface is **removed**. `Slider`/`Stepper` are
  binding-first (initial value read from the signal); `Toggle` also offers the
  SwiftUI-closer `of(label, isOn)` overload; `Color.of(int)` alias.
- **One modifier mechanism**: core modifiers are `ViewModifier` values
  (`Padding.of(16)`, `ForegroundStyle.of(color)`, `Border.of(color, width)`,
  `FrameMod.of(w, h, align)`, …) applied via `.modifier(...)`; the `.padding`
  sugar delegates to `.modifier(Padding.of(...))`. Built-in and
  application-authored modifiers share the exact same surface (spec `DSL.md`
  §5.6). Reactive overloads (`ForegroundStyle.of(Signal)`,
  `Background.of(Signal)`, `FontSize.of(Signal)`) re-emit only the bound node.
  Enum-collision modifier names use the `Mod` suffix (`FontWeightMod`,
  `TextAlignmentMod`, `TruncationMod`, `TextCaseMod`, `FontStyleMod`,
  `FontDesignMod`, `ControlSizeMod`); `FrameMod` avoids `emit.Frame`.
- **Views**: `View` (open interface), `VStack`, `HStack`, `ZStack`, `Group`
  (transparent container, maps to a `VSTACK` node today), `Text`, `Image`,
  `Color` (dual identity: a `COLOR` view *and* a value passed into style
  modifiers), shapes (`Rectangle`, `Circle`, `Capsule`, `Ellipse`,
  `RoundedRectangle`, generic `Shape.of(ShapeKind)` — all `SHAPE` nodes),
  `Button`, `TextField`, `Spacer`, `TextEditor`, `Toggle`, `Slider`, `Stepper`,
  `ProgressView`, `Gauge`, `Divider`, `Grid`, `ScrollView`, `LazyVStack`,
  `LazyHStack`, `LazyVGrid`, `LazyHGrid`, `Picker`, `Menu`, `ColorPicker`,
  `DatePicker`; `body()` composition; `ButtonStyle`/`ViewModifier`/`Environment`
  (ScopedValue).
- **Component IDs**: synced to the spec's grouped ranges (`Components.java`:
  `TEXT 0x01`, `IMAGE 0x02`, `COLOR 0x03`, `SHAPE 0x04`, `DIVIDER 0x05`,
  `SPACER 0x06`, `PROGRESS_VIEW 0x07`, `GAUGE 0x08`, `VSTACK 0x10`,
  `HSTACK 0x11`, `ZSTACK 0x12`, `GRID 0x13`, `SCROLLVIEW 0x14`, `LAZY_*`,
  `BUTTON 0x20`, `TEXT_FIELD 0x21`, `TEXT_EDITOR 0x22`, `TOGGLE 0x24`,
  `SLIDER 0x25`, `STEPPER 0x26`, `DATE_PICKER 0x27`, `PICKER 0x28`,
  `MENU 0x29`, `COLOR_PICKER 0x2A`, `COMMENT 0x7F`, …) — frames are spec-valid
  and cross-language correct.
- **Value controls**: `Toggle`/`Slider`/`Stepper`/`Picker`/`ColorPicker`/
  `Menu` bind to writable signals and route `VALUE_CHANGED` through the
  emitter's value-input registry; `TextEditor` mirrors `TextField`.
  `DatePicker` emits `STYLE::SET_DATE` (and re-emits it on signal change via a
  node-level date binding) and routes `DATE_CHANGED` through a dedicated
  date-input registry (`RenderResult.dateInputs`).
- **Events**: the full catalog round-trips — pointer, `KEY_*`, `VALUE_CHANGED`,
  `TEXT_CHANGED`, `FOCUS_CHANGED`, `EDITING_CHANGED`, `SUBMIT`, `SCROLL`,
  `WHEEL`, `DATE_CHANGED`; listener bits `0..9` declared
  (`Commands.Listeners`). `FrameCodec.decodeEvents` decodes all of them.
- **Modifiers** (chainable on any view): `padding`, `foregroundStyle(Color)`
  (no `.color()`), `background(Color)`, `tint(Color)`, `opacity`, `fontSize`,
  `fontWeight`, `border` (`border(Color, width)` canonical + `(width, color,
  radius)` convenience), `visible`/`hidden`, `frame` (fixed and
  min/ideal/max), `offset`, `position`, `fixedSize`, `layoutPriority`,
  `zIndex`, `aspectRatio`/`scaledToFit`/`scaledToFill`, `minimumScaleFactor`,
  `fontStyle`/`italic`/`fontDesign`/`fontWidth`/`kerning`/`tracking`/
  `baselineOffset`/`lineSpacing`/`lineLimit`/`multilineTextAlignment`/
  `truncationMode`/`textCase`/`underline`/`strikethrough`/`fontFamily`,
  `cornerRadius`, `shadow`, `blur`, `saturation`/`contrast`/`brightness`/
  `grayscale`/`hueRotation`/`colorMultiply`/`colorInvert`, `clipped`/
  `clipShape`, `rotation`, `scaleEffect`, `disabled`, `allowsHitTesting`,
  `controlSize`, `accessibilityLabel`/`accessibilityRole`/`accessibilityState`,
  `imageSource`, `pointerEvents` (OR-in), `actionId`/`bindingId`,
  `onTapGesture` — `Color` is never a modifier.
- **Value types**: `ValueTypes.forProperty` mirrors `value_type_for` —
  `COLOR` family → `COLOR`; `VISIBLE`/`ENABLED`/`CLIPS_TO_BOUNDS`/`UNDERLINE`/
  `STRIKETHROUGH`/`COLOR_INVERT`/`ALLOWS_HIT_TESTING`/`IS_SECURE`/
  `IS_INDETERMINATE`/`FIXED_SIZE_*`/`SELECTED` → `U8`; `LINE_LIMIT`/`SELECTION`/
  `ACTION_ID`/`BINDING_ID`/`EVENT_LISTENERS`/`BORDER_EDGES` → `U32`;
  `LABEL`/`PROMPT`/`FONT_FAMILY`/`IMAGE_SOURCE` → `STRING`; enum-valued
  properties ride as `F32` holding the numeric enum code. `FontWeight` uses the
  spec's numeric 100–900 scale.
- **Signals** (`com.pathland.view.signal`): `signal`/`computed`/`effect`/
  `untracked` — glitch-free synchronous flush, equality suppression,
  circular-dependency detection.
- **Emitter** (`emit`): mounts once, stable ids, node-level binding effects
  (a signal change re-emits only that node), `FrameOpcodeSink` /
  `RingOpcodeSink`.
- **Wire codec** (`transport`): `FrameCodec` — self-contained `PLPL` frames
  both directions, `encodeEvents`/`decodeEvents` (host→guest events with
  `TEXT_CHANGED` string-section offsets).
- **FFM ring interop** (`ffm`): lazy `libpathland_core` binding, zero JNI.
- **State** (`state`): `StateStore`/`PersistentState`/`State`, auto-wired by
  `pathland-view-processor`.

## Not implemented / gaps

- `ACTION_ID`/`BINDING_ID` are usable as modifiers (`actionId`/`bindingId`) but
  the Java model routes events by node id through the emitter's registries
  (`RenderResult`), so controls don't set them automatically.
- No `STYLE::SET_DESIGN_TOKEN` DSL helper.

## Verified by

`mvn test` (needs JDK 25) — emitter, codec round-trips, signals, state.