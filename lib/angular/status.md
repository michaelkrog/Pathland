# lib/angular — implementation status

**Last updated:** August 28, 2026

The Angular 21 **browser renderer** mapping opcode frames onto the
`@apaq/ngui` design system (`ui-vstack`/`ui-text`/`ui-button`/…). Protocol
contract: `spec/`.

## Implemented

- **Decoder** (`core/decoder.ts`): `PLPL` batch decode (`decodeFrame`),
  `HOST_TO_GUEST` direction, `TEXT_CHANGED` string-section resolution.
- **Event encoder** (`core/event-encoder.ts`): host→guest event batches
  (`HOST_TO_GUEST`, `TEXT_CHANGED` with string offsets) — the client actively
  sends events (`session.service.ts: sendTextChanged`).
- **ngui mapping** (`ngui/mapping.ts`): `VSTACK`, `HSTACK`, `TEXT`, `BUTTON`,
  `IMAGE`, `SWITCH`, `TEXT_FIELD`, `SPACER`, `SCROLLVIEW`, `LIST`, `GRID`,
  `COMMENT`, `CHECKBOX`, `SLIDER`; stack alignment/text-alignment mapping.
- **Session** (`ngui/session.service.ts`): connects to `/ws`, the server
  replays the mount frame on connect (`SessionApp`).

## Not implemented / gaps

- **Component IDs are the legacy pre-renumber values** (`core/protocol.ts`) —
  not yet synced to the grouped ranges in `spec/PRIMITIVES.md`. The boolean
  control is still `SWITCH`/`CHECKBOX`, not `TOGGLE` + `TOGGLE_STYLE`.
- No `TOGGLE_STYLE`, `ZSTACK`, `COLOR`, `SHAPE`, `DIVIDER`, `PROGRESS_VIEW`,
  `GAUGE`, `LAZY_*`, `TEXT_EDITOR`, `STEPPER`, `DATE_PICKER`, `PICKER`,
  `MENU`, `COLOR_PICKER`; no `ACTION_ID`/`BINDING_ID` gating.

## Verified by

`ng test` — decoder/protocol/mapping specs.