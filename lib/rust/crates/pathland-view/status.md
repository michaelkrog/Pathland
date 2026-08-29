# pathland-view (Rust DSL) — implementation status

**Last updated:** August 28, 2026

The SwiftUI-style **view DSL** (`no_std`) building `pathland_engine::Node`
trees. Protocol contract: `spec/`.

## Implemented

- **Views**: `VStack`, `HStack`, `Text`, `Spacer`, `Button` (+ `vstack!` /
  `hstack!` macros and the `text`/`spacer`/`button` free functions).
- **Modifiers** (chainable, decoupled): `spacing`, `padding`, `font_size`,
  `color`, `background`, `frame(width/height/alignment)`, `pointer_events`,
  `on_tap_gesture`.
- **Composition**: blanket `ViewExt::modifier` + `ViewModifier` for custom
  modifiers; `Modified<V, M>` wrapper.
- **Alignment enum** (`Align`): Leading/Center/Trailing/Fill.

## Not implemented / gaps

- Only five components — no `Image`, `Color`, `Shape`, `Toggle`, `Slider`,
  `TextField`, containers, or the semantic controls.
- Only the subset of modifiers above; no per-edge padding sugar, no
  `ACTION_ID`/`BINDING_ID` helpers, no `TOGGLE_STYLE`.

## Verified by

`cargo test -p pathland-view` — builder, modifier chaining, `assign_ids`,
tap-gesture listener wiring.