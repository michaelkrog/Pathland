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
- **Delta application** (`src/apply.ts`):
  - **STYLE**: `SET_TEXT` (text fields/editors/label spans), `SET_DATE`,
    `SET_PROPERTY` — strings (`LABEL`, `PROMPT`) and numerics (`SELECTED`,
    `VALUE`, `SELECTION`, `COLOR_VALUE`, `ENABLED`, plus structural style).
  - **TREE**: `CREATE_NODE`/`DELETE_NODE`/`INSERT_CHILD`/`REMOVE_CHILD`/
    `MOVE_CHILD` — the element shell factory (`src/elements.ts`) creates nodes
    at runtime and structural deltas apply in place (no full reload).
- **Event encoders** (`src/events.ts`): guest → host (flags `0x0000`)
  `POINTER_UP`, `VALUE_CHANGED` (f32 or raw bits), `DATE_CHANGED`,
  `TEXT_CHANGED` (string section).
- **Transport** (`src/transport.ts`): WebSocket connect, protocol-version
  negotiation (mismatch → reload), exponential-backoff reconnect, and a
  defensive per-batch try/catch.
- **Styling (Option A)**: the protocol stays renderer-agnostic. The SSR HTML
  carries Tailwind classes; runtime style deltas are applied as **inline style**
  (`src/classes.ts`), literal colors inline, and semantic design tokens as CSS
  variables. `STATE`/`SELECTED`/`ENABLED` toggle a bounded class/ARIA set.
- **Tests** (`test/`, vitest + happy-dom): codec round-trips (incl. a byte
  round-trip through `parseBatch`), TREE/STYLE application, event byte layouts,
  Option A style appliers, and transport (fake socket) — 38 tests.

## Not implemented / gaps

- **Session-resync + `frameCount` gap detection** on reconnect (P3): the
  `Transport.onBatch` hook is the seam, but the client does not yet request a
  full snapshot or sequence batches.
- `ALIGNMENT`/`STATE` runtime enum semantics are applied best-effort; exact wire
  bit semantics need golden vectors (grant WP2 conformance).
- `SET_DESIGN_TOKEN` is not decoded yet (the Java DSL has no token helper; the
  CSS-variable path is designed but not wired).
- The element factory's base inline layout styles for runtime-created nodes are
  functional but not yet golden-tested against the Rust/Java renderers'
  class mapping (drift guard TODO).

## Verified by

`npm test` (vitest, 38 tests) + `npm run typecheck` (strict TS). CI runs the
web-client job (typecheck + test + build + copy-to-demos drift check).