# pathland-engine — implementation status

**Last updated:** August 28, 2026

The retained-tree **emitter**: the application's canonical UI tree and the
diff-based reactive emission into `TREE`/`STYLE` opcodes. Protocol contract:
`spec/`.

## Implemented

- **Retained tree** (`node.rs`): `Node` (id, component, children, properties,
  text/property signal bindings, app-side gestures).
- **Components** (`Component` enum): `VStack`, `HStack`, `Text`, `Button`,
  `Spacer` — mapped to `component_type` ids via `component_type_id`.
- **Diff emitter** (`engine.rs`): create/delete/insert/move deltas,
  property/text deltas, steady-state zero emission.
- **Reactive signals** (`signal.rs`): writable signals bound to node
  text/properties; `set_signal` re-emits only the bound nodes
  (`SET_TEXT`/`SET_PROPERTY`).
- **Gestures**: `Tap` (app-side callback, never serialized).
- **`assign_ids`** (pre-order stable ids).

## Not implemented / gaps

- Only the five components above exist in `Component`; the full spec surface
  (Image, Color, Shape, Toggle, Slider, TextField, containers, …) has no
  engine-side component yet.
- Only `Tap` gesture; no computed-signal effects in the engine (Java has them).

## Verified by

`cargo test -p pathland-engine` — emitter deltas, signals, `component_type_id`.