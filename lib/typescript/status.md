# @pathland/dom-renderer (lib/typescript) — implementation status

**Last updated:** September 1, 2026

The **Pathland DOM renderer** — the web client. A vanilla-TypeScript hydration
client (no runtime dependencies) that is the single source of the client,
replacing the two duplicated `app.js` files in the demos. Protocol contract:
`spec/`.

## Implemented

- **Single source, unified**: `src/` is the one client; `npm run build` emits
  `dist/pathland-dom-renderer.js` (IIFE, minified via esbuild), and
  `npm run copy-to-demos` copies it into both the Quarkus and Spring Boot demos'
  static resource dirs. Both demos serve `/pathland-dom-renderer.js`; the old
  duplicated `app.js` is removed.
- **Hydration**: builds the `data-pathland-id → element` registry from the SSR
  DOM.
- **PLPL decode** (`src/plpl.ts`): bounds-checked batch parse — magic/version
  validation, truncated-opcode/string rejection, length-prefixed string reads.
- **Full delta application** (`src/apply.ts`):
  - **STYLE commands**: `SET_PROPERTY`, `SET_TEXT`, `SET_DATE` (date/time/
    datetime-local), **`SET_DESIGN_TOKEN`** (→ CSS variables, `src/tokens.ts`).
  - **TREE commands**: `CREATE_NODE`/`DELETE_NODE`/`INSERT_CHILD`/`REMOVE_CHILD`/
    `MOVE_CHILD` (`u32::MAX` append handled) — the element-shell factory
    (`src/elements.ts`) covers every primitive/control component.
  - **META commands**: `RESET` clears the DOM + registry; `ENVIRONMENT` accepted.
- **Full property applier** (`src/classes.ts`, table-driven): the complete
  spec/MODIFIERS.md + control/semantic catalog — layout (spacing/alignment/
  margins/offset/position/frame min-ideal-max/fixed-size/layout-priority/
  aspect-ratio/content-mode), text (align/line-limit/truncation/font-size/
  weight/style/design/width/kerning/tracking/baseline/line-spacing/text-case/
  underline/strikethrough), styling (color/background/border width-color-radius-
  edges/z-index/clips-to-bounds/padding*/tint), effects (shadow/blur/saturation/
  contrast/brightness/grayscale/hue-rotation/color-invert/rotation/scale/
  allows-hit-testing), semantic (role/state/enabled/selected/value/min-max/label/
  prompt), **structural control variants** (is-secure text↔password,
  toggle-style switch↔checkbox↔button, date-picker-mode date↔time↔datetime-local,
  picker-style/control-size as data tokens, step-value, progress/indeterminate),
  binding (action-id/binding-id as `data-*`), image-source, shape-kind.
- **Value types**: `U8`/`U32`/`I32`/`F32`/`STRING`/`ENUM`/`COLOR`/`DESIGN_TOKEN`
  handled (`enumCode`/`f32`/`isOn` decoders in classes.ts; token values in
  tokens.ts).
- **Full event encoders** (`src/events.ts`): `POINTER_DOWN` (x/y + secondary),
  `POINTER_MOVE` (x/y + hover enter/leave), `POINTER_UP` (x/y + secondary),
  `KEY_DOWN`/`KEY_UP` (keyCode + modifiers + repeat), `VALUE_CHANGED` (f32 or
  raw bits), `TEXT_CHANGED` (string section), `DATE_CHANGED`, `FOCUS_CHANGED`,
  `EDITING_CHANGED`, `SUBMIT`, `SCROLL`, `WHEEL` — guest → host (flags
  `0x0000`).
- **`EVENT_LISTENERS` gating**: `src/index.ts` reads the SSR `data-event-listeners`
  mask (mirroring the Rust renderer's event attrs) and emits an event only when
  the node opted into it; absent attribute = permissive (no gating info).
- **Transport** (`src/transport.ts`): WebSocket connect, protocol-version
  negotiation (mismatch → reload), exponential-backoff reconnect, defensive
  per-batch try/catch.
- **Styling (Option A)**: the protocol stays renderer-agnostic; the SSR HTML
  carries Tailwind classes; runtime style deltas apply as inline style, literal
  colors inline, design tokens as CSS variables.
- **Tests** (`test/`, vitest + happy-dom): codec round-trips, TREE/STYLE/META
  application, design tokens, event byte layouts, and one golden assertion per
  property/enum — 73 tests.

## Not implemented / gaps

- **Session-resync + `frameCount` gap detection** on reconnect (P3): the
  `Transport.onBatch` hook is the seam; the client does not yet request a full
  snapshot or sequence batches.
- **Canonical keyCode table**: `KEY_DOWN`/`KEY_UP` use the DOM `event.keyCode`
  convention; the renderer-shared canonical set lives in the conformance
  vectors (grant WP2) — cross-check on landing.
- **Visual tokens** (`PICKER_STYLE`, `CONTROL_SIZE`, `MINIMUM_SCALE_FACTOR`,
  `COLOR_MULTIPLY`) are applied as `data-*` attributes; their *visual* variety is
  renderer-styling-owned (Tailwind/theme), not the protocol's job.
- The element factory's runtime shells are functional but not yet
  golden-tested against the Rust/Java renderers' SSR markup (drift guard TODO).
- `STATE`/`ROLE` map to ARIA attributes; exact bit semantics should be
  cross-checked against the conformance vectors when they land.

## Verified by

`npm test` (vitest, 73 tests) + `npm run typecheck` (strict TS). CI runs the
web-client job (typecheck + test + build + copy-to-demos drift check).