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
- **Modifiers**: `foregroundStyle(Color)` (no `.color()`), `background(Color)`,
  `tint(Color)`, padding/opacity/font/etc. — `Color` is never a modifier.
- **Value types**: `ValueTypes.forProperty` mirrors `value_type_for`
  (`VISIBLE`/`ENABLED`/`CLIPS_TO_BOUNDS` are `U8`); `FontWeight` uses the spec's
  numeric 100–900 scale.
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

- Missing **modifiers/properties** (text-format, effects, transform, layout
  bounds, semantic extras) — see `spec/MODIFIERS.md`; the `View` chain surface
  covers only a subset.
- Missing **control views**: `Toggle`/`Slider`/`TextEditor`/`Picker`/
  `DatePicker`/`Menu`/`ColorPicker`/`Stepper`/`ProgressView`/`Gauge`/
  `Divider`/`Grid`/`ScrollView`/lazy stacks, and the `ACTION_ID`/`BINDING_ID`
  helpers that route their events.
- Missing **events**: `FrameCodec.decodeEvents` decodes pointer +
  `VALUE_CHANGED` + `TEXT_CHANGED` only — no `KEY_*`, `FOCUS_CHANGED`,
  `EDITING_CHANGED`, `SUBMIT`, `SCROLL`, `WHEEL`, `DATE_CHANGED`; no
  `STYLE::SET_DATE` command; no arbitrary `EVENT_LISTENERS` modifier (only
  `TapGestureView`).
- `Truncation` has an extra `NONE` value not in the spec.

## Verified by

`mvn test` (needs JDK 25) — emitter, codec round-trips, signals, state.