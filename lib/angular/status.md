# lib/angular — implementation status

**Last updated:** August 29, 2026

The Angular 21 **browser renderer** mapping opcode frames onto the
`@apaq/ngui` design system (`ui-vstack`/`ui-text`/`ui-button`/…). Protocol
contract: `spec/`.

## Implemented

- **Protocol constants** (`core/protocol.ts`): synced to the spec's grouped
  component ranges (`TEXT 0x01`, `COLOR 0x03`, `VSTACK 0x10`, `HSTACK 0x11`,
  `TOGGLE 0x24`, `SLIDER 0x25`, `COMMENT 0x7F`, …), full property catalog
  (incl. `TINT`/`SHAPE_KIND`/`TOGGLE_STYLE`/`PICKER_STYLE`/`SELECTION`/
  `COLOR_VALUE`/`DATE_PICKER_MODE`/…), `STYLE::SET_DATE`, the full event
  catalog (`KEY_*`, `FOCUS_CHANGED`, `EDITING_CHANGED`, `SUBMIT`, `SCROLL`,
  `WHEEL`, `DATE_CHANGED`), listener bits 0–9, and `FONT_WEIGHT` on the spec's
  100–900 scale.
- **Decoder** (`core/decoder.ts`): `PLPL` batch decode (`decodeFrame`),
  `HOST_TO_GUEST` direction, `TEXT_CHANGED` string-section resolution.
- **Retained tree** (`core/retained-tree.ts`): applies `TREE`/`STYLE` deltas
  including `STYLE::SET_DATE` (node date state).
- **Event encoder** (`core/event-encoder.ts`): host→guest event batches —
  pointer, `VALUE_CHANGED` (f32 or raw bits), `TEXT_CHANGED` with string
  offsets, `DATE_CHANGED` (days/millis).
- **ngui mapping** (`ngui/mapping.ts`): all spec components — stacks (incl.
  `LAZY_*`), `ZSTACK`, `GRID`, `SCROLLVIEW`, `TEXT`, `BUTTON`, `IMAGE`,
  `COLOR`, `SHAPE`, `DIVIDER`, `SPACER`, `TEXT_FIELD`, `TEXT_EDITOR`,
  `TOGGLE` (`TOGGLE_STYLE` → switch/checkbox/button), `SLIDER`, `STEPPER`,
  `PICKER`, `MENU`, `COLOR_PICKER`, `DATE_PICKER`, `PROGRESS_VIEW`, `GAUGE`;
  `hidden` reads the `VISIBLE` `U8` bit.
- **Renderer** (`ngui/node.component.ts|html`): one case per kind — ngui views
  for the supported ones, native HTML elements for the rest (textarea, select,
  color/date inputs, range, progress, gauge, stepper); input routed back as
  `VALUE_CHANGED`/`TEXT_CHANGED`/`DATE_CHANGED`.
- **Session** (`ngui/session.service.ts`): connects to `/ws`, the server
  replays the mount frame on connect (`SessionApp`).

## Not implemented / gaps

- No `ACTION_ID`/`BINDING_ID` gating (the Java emitter routes by node id via
  `RenderResult` registries).
- `app.spec.ts` is an `ng test` (Karma/Jasmine) spec; the unit specs
  (`core.spec.ts`, `mapping.spec.ts`) run under vitest.

## Verified by

`npx vitest run` (18 unit tests) + `ng build` (template/TS compilation).