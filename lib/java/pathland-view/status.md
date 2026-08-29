# pathland-view (Java) — implementation status

**Last updated:** August 28, 2026

The hand-written, framework-agnostic Java 25+ DSL (`com.pathland.view`):
SwiftUI-style views, Angular-style signals, fine-grained emitter, `PLPL` wire
codec, lazy FFM ring interop, and cross-platform `State`. Protocol contract:
`spec/`.

## Implemented

- **Views**: `View` (open interface), `VStack`, `HStack`, `ZStack`, `Text`,
  `Image`, `Color`, `Rectangle`, `Button`, `TextField`, `Spacer`; `body()`
  composition; `ButtonStyle`/`ViewModifier`/`Environment` (ScopedValue).
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

- **Component IDs are the legacy pre-renumber values** (`Components.java`:
  `HSTACK 0x0001`, `VSTACK 0x0002`, `SWITCH 0x0006`, `CHECKBOX 0x000D`, `LIST
  0x000A`, …) — not yet synced to the grouped ranges in `spec/PRIMITIVES.md`.
- `ZStack` currently materializes as `COMMENT` (no `ZSTACK` component id yet).
- No `Toggle`/`Slider`-style token (`TOGGLE_STYLE`), no `ACTION_ID`/
  `BINDING_ID` helpers, no `TEXT_EDITOR`/`PICKER`/`DATE_PICKER`/`MENU` views.

## Verified by

`mvn test` (needs JDK 25) — emitter, codec round-trips, signals, state.