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
- **Event encoder** (`core/event-encoder.ts`): host→guest event batches for the
  full raw-input catalog — pointer down/move/up, `KEY_*`, `VALUE_CHANGED`
  (f32 or raw bits), `TEXT_CHANGED` with string offsets, `FOCUS_CHANGED`,
  `EDITING_CHANGED`, `SUBMIT`, `SCROLL`, `WHEEL`, `DATE_CHANGED`; matching
  senders on `session.service.ts`.
- **ngui mapping** (`ngui/mapping.ts`): all spec components — stacks (incl.
  `LAZY_*`), `ZSTACK`, `GRID`, `SCROLLVIEW`, `TEXT`, `BUTTON`, `IMAGE`,
  `COLOR`, `SHAPE`, `DIVIDER`, `SPACER`, `TEXT_FIELD`, `TEXT_EDITOR`,
  `TOGGLE` (`TOGGLE_STYLE` → switch/checkbox/button), `SLIDER`, `STEPPER`,
  `PICKER`, `MENU`, `COLOR_PICKER`, `DATE_PICKER`, `PROGRESS_VIEW`, `GAUGE`;
  `hidden` reads the `VISIBLE` `U8` bit.
- **Renderer** (`ngui/node.component.ts|html` + `ngui/nodes/`): one case per
  kind, using **only `@apaq/ngui` components** — stacks/grids/`ui-text`/
  `ui-rectangle`/`ui-circle`/`ui-image`/`ui-spacer`/`ui-scroll-view` stay eager
  (the light `core` entry, always needed). The **control kinds are lazy-loaded
  per kind via `@defer (on immediate)`** (`nodes/`): `button-node`,
  `toggle-node`, `text-field-node`, `text-editor-node`, `picker-node`,
  `menu-node`, `date-picker-node` — each imports only its own ngui entry
  (`components`, `select`, `text-field`, `text-area`, `date-picker`, `overlay`),
  so a tree that uses none of them never fetches those chunks (verified: main
  bundle holds only core; select/date-picker/menu/text-field/text-area land in
  separate lazy chunks). Protocol components the design system lacks render a
  temporary **"not implemented" placeholder** (`NotImplementedComponent`,
  ngui-styled): `SLIDER`, `STEPPER`, `PROGRESS_VIEW`, `GAUGE`, `COLOR_PICKER`,
  `DIVIDER`, `SecureField`, `PICKER::Wheel`, `DATE_PICKER::Time/DateAndTime`,
  `SHAPE::Path`.
- Input is routed back as `VALUE_CHANGED`/`TEXT_CHANGED`/`DATE_CHANGED`
  (toggle/checkbox/button, select/radio-group/segmented, menu, text-area,
  date-picker).
- **Modifier mapping** (`ngui/mapping.ts`): padding, color, background
  (color + CSS filter from blur/saturation/contrast/brightness/grayscale/
  hueRotation/colorInvert), border, rounding, opacity, font (size/weight/
  family/style/lineHeight), frame (width/height/min/max + alignment),
  flex (FILL), lineLimit, `[shadow]`, `[rotationEffect]`, `[underline]`,
  stack/text alignment.
- **Session** (`ngui/session.service.ts`): connects to `/ws`, the server
  replays the mount frame on connect (`SessionApp`).

## Not implemented / gaps

- No `ACTION_ID`/`BINDING_ID` gating (the Java emitter routes by node id via
  `RenderResult` registries).
- Protocol components without an ngui equivalent render as "not implemented"
  placeholders (listed above) until the design system adds them.
- Protocol modifiers without an ngui equivalent are skipped: `STRIKETHROUGH`,
  `TEXT_CASE`, `KERNING`, `TRACKING`, `OFFSET`, `POSITION`, `FIXED_SIZE`,
  `LAYOUT_PRIORITY`, `ASPECT_RATIO`/`CONTENT_MODE`, `MINIMUM_SCALE_FACTOR`,
  `SCALE`, `CLIPS_TO_BOUNDS`, `Z_INDEX`, `TINT`, `CONTROL_SIZE`.
- Only the events ngui components expose are wired today (`click` → pointer-up,
  `valueChange`/`checkedChange`/`onSelect` → `VALUE_CHANGED`, text-area →
  `TEXT_CHANGED`, date-picker → `DATE_CHANGED`). The other encoders/senders
  (pointer down/move, `KEY_*`, focus/editing/submit/scroll/wheel) are ready on
  the wire but not yet produced by ngui components.

## Verified by

- `ng test` — the package's canonical runner (Angular unit-test builder over
  vitest): all 3 spec files, 25 tests, including the TestBed `app.spec.ts`.
- `npx vitest run` — the pure protocol/renderer unit specs (`core.spec.ts`,
  `mapping.spec.ts`), 24 tests, via `vitest.config.ts` (which excludes the
  TestBed component spec; see the config comment).
- `ng build` — template/TS compilation.