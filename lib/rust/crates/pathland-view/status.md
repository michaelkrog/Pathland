# pathland-view (Rust DSL) — implementation status

**Last updated:** August 28, 2026

The SwiftUI-style **view DSL** (`no_std`) building `pathland_engine::Node`
trees. Protocol contract: `spec/`.

## Implemented

- **Views**: `VStack`, `HStack`, `ZStack`, `Grid`, `ScrollView`, `LazyVGrid`,
  `LazyHGrid`, `LazyVStack`, `LazyHStack`, `Text`, `Button`, `Spacer`,
  `Image`, `ColorView` (protocol `COLOR`), `Shape`, `Divider`,
  `ProgressView`, `Gauge`, `Toggle`, `Slider`, `TextField`, `TextEditor`,
  `Stepper`, `DatePicker`, `Picker`, `Menu`, `ColorPicker` (+ the
  `vstack!`/`hstack!` macros and `text`/`spacer`/`button` free functions).
- **Modifiers** (chainable, decoupled): `spacing`, `padding`, `font_size`,
  `font_weight`, `color`, `background`, `frame(width/height/alignment)`,
  `opacity`, `hidden`, `border`, `corner_radius`, `line_limit`,
  `text_alignment`, `truncation_mode`, `offset`, `position`, `z_index`,
  `pointer_events`, `on_tap_gesture`.
- **Composition**: blanket `ViewExt::modifier` + `ViewModifier` for custom
  modifiers; `Modified<V, M>` wrapper.
- **Alignment enum** (`Align`): Leading/Center/Trailing/Fill.

## Not implemented / gaps

- No `strings` plumbing for STRING-valued properties — `TextField`'s
  `PROMPT` and `Color`/`Image` sources are stored as placeholder values only;
  `FONT_FAMILY`/`LABEL`/`IMAGE_SOURCE` need an engine `Node` strings map.
- No `ACTION_ID`/`BINDING_ID` helpers, no `TOGGLE_STYLE`-typed API (raw u8).

## Verified by

`cargo test -p pathland-view` — builder, modifier chaining, `assign_ids`,
tap-gesture listener wiring, new-component building.