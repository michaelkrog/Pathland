# pathland-view (Java) — implementation status

**Last updated:** August 29, 2026

The hand-written, framework-agnostic Java 25+ DSL (`com.pathland.view`):
SwiftUI-style views, Angular-style signals, fine-grained emitter, `PLPL` wire
codec, lazy FFM ring interop, and cross-platform `State`. Protocol contract:
`spec/`.

## Implemented

- **Views**: `View` (open interface), `VStack`, `HStack`, `ZStack`, `Text`,
  `Image`, `Color` (dual identity: a `COLOR` view *and* a value passed into
  style modifiers), `Rectangle` (a `SHAPE` node), `Button`, `TextField`,
  `Spacer`; `body()` composition; `ButtonStyle`/`ViewModifier`/`Environment`
  (ScopedValue).
- **Component IDs**: synced to the spec's grouped ranges (`Components.java`:
  `TEXT 0x01`, `IMAGE 0x02`, `COLOR 0x03`, `SHAPE 0x04`, `SPACER 0x06`,
  `VSTACK 0x10`, `HSTACK 0x11`, `ZSTACK 0x12`, `BUTTON 0x20`, `TEXT_FIELD 0x21`,
  `TOGGLE 0x24`, `SLIDER 0x25`, `COMMENT 0x7F`, …) — frames are spec-valid and
  cross-language correct.
- **Modifiers** (chainable on any view): `padding`, `foregroundStyle(Color)`
  (no `.color()`), `background(Color)`, `tint(Color)`, `opacity`, `fontSize`,
  `fontWeight`, `border`, `visible`/`hidden`, `frame` (fixed and
  min/ideal/max), `offset`, `position`, `fixedSize`, `layoutPriority`,
  `zIndex`, `aspectRatio`/`scaledToFit`/`scaledToFill`, `minimumScaleFactor`,
  `fontStyle`/`italic`/`fontDesign`/`fontWidth`/`kerning`/`tracking`/
  `baselineOffset`/`lineSpacing`/`lineLimit`/`multilineTextAlignment`/
  `truncationMode`/`textCase`/`underline`/`strikethrough`/`fontFamily`,
  `cornerRadius`, `shadow`, `blur`, `saturation`/`contrast`/`brightness`/
  `grayscale`/`hueRotation`/`colorMultiply`/`colorInvert`, `clipped`/
  `clipShape`, `rotation`, `scaleEffect`, `disabled`, `allowsHitTesting`,
  `controlSize`, `accessibilityLabel`/`accessibilityRole`/`accessibilityState`,
  `imageSource` — `Color` is never a modifier.
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

- Missing **control views**: `Toggle`/`Slider`/`TextEditor`/`Picker`/
  `DatePicker`/`Menu`/`ColorPicker`/`Stepper`/`ProgressView`/`Gauge`/
  `Divider`/`Grid`/`ScrollView`/lazy stacks, and the `ACTION_ID`/`BINDING_ID`
  helpers that route their events.
- Missing **events**: `FrameCodec.decodeEvents` decodes pointer +
  `VALUE_CHANGED` + `TEXT_CHANGED` only — no `KEY_*`, `FOCUS_CHANGED`,
  `EDITING_CHANGED`, `SUBMIT`, `SCROLL`, `WHEEL`, `DATE_CHANGED`; no
  `STYLE::SET_DATE` command; no arbitrary `EVENT_LISTENERS` modifier (only
  `TapGestureView`).

## Verified by

`mvn test` (needs JDK 25) — emitter, codec round-trips, signals, state.