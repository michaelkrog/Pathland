# pathland-core — implementation status

**Last updated:** August 28, 2026

The **protocol core**: 16-byte opcode, SPSC ring buffers (both directions),
bump arenas (both directions), memory layout, typed events, and the golden
conformance vectors. The protocol contract is defined in `spec/`; this file
tracks what this crate implements.

## Implemented

- **Component types** (`constants.rs::component_type`): the full grouped map —
  `TEXT 0x01, IMAGE 0x02, COLOR 0x03, SHAPE 0x04, DIVIDER 0x05, SPACER 0x06,
  PROGRESS_VIEW 0x07, GAUGE 0x08, VSTACK 0x10, HSTACK 0x11, ZSTACK 0x12, GRID
  0x13, SCROLLVIEW 0x14, LAZY_VGRID 0x15, LAZY_HGRID 0x16, LAZY_VSTACK 0x1B,
  LAZY_HSTACK 0x1C, BUTTON 0x20, TEXT_FIELD 0x21, TEXT_EDITOR 0x22, TOGGLE
  0x24, SLIDER 0x25, STEPPER 0x26, DATE_PICKER 0x27, PICKER 0x28, MENU 0x29,
  COLOR_PICKER 0x2A, COMMENT 0x7F`.
- **Properties** (`property_id`): the stack/text/styling/semantic catalog
  (`SPACING`…`PADDING_LEFT`, `BORDER_*`, `FONT_*`, `COLOR`, `WIDTH`/`HEIGHT`,
  `OPACITY`, `VISIBLE`, `Z_INDEX`, `CLIPS_TO_BOUNDS`, `ROLE`/`STATE`,
  `ENABLED`, `SELECTED`, `EVENT_LISTENERS`, `VALUE`/`MIN_VALUE`/`MAX_VALUE`,
  `LABEL`/`PROMPT`, and the draft `SHAPE_KIND`, `STEP_VALUE`, `CONTROL_SIZE`,
  `IS_SECURE`, `PROGRESS`, `IS_INDETERMINATE`, `SELECTION`, `COLOR_VALUE`,
  `DATE_PICKER_MODE`, `PICKER_STYLE`, `ACTION_ID`, `BINDING_ID`, `TOGGLE_STYLE`,
  `IMAGE_SOURCE`).
- **Commands**: `TREE` create/delete/insert/remove/move (append = `u32::MAX`);
  `STYLE` `SET_PROPERTY`/`SET_DESIGN_TOKEN`/`SET_TEXT`/`SET_DATE`; `META`
  `RESET`/`ENVIRONMENT`.
- **EVENT commands (constants)**: `POINTER_DOWN/MOVE/UP`, `KEY_DOWN/UP`,
  `VALUE_CHANGED`, `TEXT_CHANGED`, plus the draft `FOCUS_CHANGED`,
  `EDITING_CHANGED`, `SUBMIT`, `SCROLL`, `WHEEL`, `DATE_CHANGED`.
- **Listener bits**: 0–9 (`POINTER_*`, `KEY_*`, `FOCUS`, `EDITING`, `SUBMIT`,
  `SCROLL`, `WHEEL`).
- **Typed `Event` enum**: pointer/key/value/text events (commands 0x01–0x07).
- **Shared linear memory**: 80-byte header, guest→host ring, host→guest event
  ring, guest arena, host→guest **event arena** (two-way string section — a
  host `send_event(TextChanged)` round-trips text over the shared ring).
- **Conformance vectors** (`conformance.rs`): TREE/STYLE/META/EVENT golden
  bytes; `cargo test` enforces them.

## Not implemented / gaps

- Draft commands 0x08–0x0D and `STYLE::SET_DATE` are **constants only** — no
  typed `Event` variants, no `Guest::set_date` helper (renderers decode the raw
  opcode fields themselves).
- `ENVIRONMENT` (`META`) is a constant only (no viewport plumbing).

## Verified by

`cargo test -p pathland-core` — conformance vectors, opcode round-trips,
arena, ring, event-ring (incl. shared-ring `TEXT_CHANGED` round-trip and
`META::RESET` event-arena recycle), randomized tests.