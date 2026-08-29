# pathland-view-native — implementation status

**Last updated:** August 28, 2026

The **native C-ABI shim + `NativeHost`**: a flat world over the shared-memory
ring for foreign hosts (Swift/Java/C# via FFI). Protocol contract: `spec/`.

## Implemented

- **`NativeHost`**: owns the shared ring, `create_node`/`set_property`/
  `set_text`, frame emission, `drain_events`.
- **Component mapping** (`component_from_id`/`component_id`): `HStack`,
  `VStack`, `Text`, `Button`, `Spacer` (using the renumbered ids: 0x11, 0x10,
  0x01, 0x20, 0x06).
- **Property value types** (`property_value_type`): COLOR → `COLOR`;
  `EVENT_LISTENERS`/`BORDER_EDGES`/`ACTION_ID`/`BINDING_ID` → `U32`; else `F32`.
- **Signals** C ABI (`signal_*`, `node_bind_text`/`node_bind_property`).

## Not implemented / gaps

- Only the five components above are mapped; no `TOGGLE`/`SLIDER`/`TEXT_FIELD`/
  containers/`IMAGE` flat-world construction.
- STRING properties are not fully plumbed through the flat world (no
  `IMAGE_SOURCE`/`LABEL`/`PROMPT` alloc helper).

## Verified by

`cargo test -p pathland-view-native` — flat-world emission, component mapping,
signal deltas.