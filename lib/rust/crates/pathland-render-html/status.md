# pathland-render-html (Rust) — implementation status

**Last updated:** September 1, 2026

The **server-side / remote-projection HTML renderer**: a **stateless, streaming**
pure function of the opcode stream producing declarative HTML. Each render call
decodes a self-contained snapshot batch into a **transient** map, walks it once,
and emits HTML text out — no retained tree, zero cross-call state (Renderer
Statelessness). Protocol contract: `spec/`.

## Implemented

- **Stateless streaming API**: `HtmlRenderer::render_document(opcodes, strings, root)`
  / `render_fragment(...)` build a transient decode map per call and stream HTML;
  the retained `apply`/`apply_frame`/`render` model is removed.
- **All spec components render**: `TEXT`, `IMAGE`, `COLOR` (layout-greedy:
  `flex:1;align-self:stretch`), `SHAPE` (CSS/SVG by `SHAPE_KIND`), `DIVIDER`, `SPACER`, `PROGRESS_VIEW`/`GAUGE`, `VSTACK`/
  `HSTACK`/`LAZY_VSTACK`/`LAZY_HSTACK` (flex), `ZSTACK` (overlay), `GRID`/
  `LAZY_VGRID`/`LAZY_HGRID` (CSS grid), `SCROLLVIEW`, `BUTTON`, `TEXT_FIELD`
  (incl. `IS_SECURE` → `type="password"`), `TEXT_EDITOR`, `TOGGLE`
  (`TOGGLE_STYLE`), `SLIDER`, `STEPPER`, `DATE_PICKER` (`SET_DATE` →
  `days_to_date`), `PICKER` (option children + `SELECTION`), `MENU`,
  `COLOR_PICKER`, `COMMENT`.
- **Composite override mode**: `BUTTON`/`TOGGLE`/`SLIDER` with children render
  the custom body wrapped in the native element.
- **Properties**: `ALIGNMENT` (cross-axis flex), `CONTENT_MARGINS`,
  `WIDTH`/`HEIGHT` (`FILL`/`HUG`), `PADDING` + per-edge, `COLOR`,
  `BACKGROUND_COLOR`, `FONT_SIZE`/`WEIGHT`/`FAMILY`, `OPACITY`, `VISIBLE`,
  `Z_INDEX`, `LINE_LIMIT`, `TEXT_ALIGNMENT`, `TRUNCATION_MODE`, `BORDER_*`,
  `SELECTED`, `TOGGLE_STYLE`, `ENABLED`, `ROLE`/`STATE` (ARIA).
- **Event surfacing**: `data-event-listeners` / `data-action-id` /
  `data-binding-id` attributes.
- `STYLE::SET_DATE` handled (days + millis-of-day → date/time).

## In progress (P2a)

- **Tailwind emission — structural (Phase 1, landed)** and **decorative/
  typography (Phase 2, landed)**: stacks/grids/padding/size/z-index/opacity/
  visibility/position (Phase 1) plus text size/weight/align, line-clamp/truncate,
  text-case, underline/strikethrough, italic/font-design, border-radius,
  blur/saturate/contrast/brightness/grayscale/hue-rotate/invert, rotate/scale/
  translate, overflow-hidden, pointer-events-none (Phase 2) all emit Tailwind
  utility classes. **Literal colors and string font-family stay inline** (Option A:
  color, background, border width/color/edges, shadows are color-dependent and
  remain renderer-owned inline).
- **Safelist derivation (`src/tw.rs`)**: `tw::safelist()` lists the exact classes
  the renderer can emit (named utilities + arbitrary-value ranges for both
  phases) for the `@source inline(...)` compiler input — generated from the same
  table used by emission, so emission and safelist cannot drift. Wired into the
  compiler in Phase 3.
- **Tailwind v4 integration (Phase 3, landed)**: `tailwind.rs` provides the
  bundled default `@theme` config (Inter, OFL) + `assemble_input(default,
  override, classes)` (pure, tested) + `compile(...)` that spawns the compiler
  and returns the CSS. The compiler is the **per-platform standalone binary,
  feature-gated (`tailwind-embed`)**: build.rs embeds it via `include_bytes!`
  (clear panic if missing); `scripts/fetch-tailwind.mjs` fetches it into
  `vendor/<target-triple>/`. With the feature off, `compile` falls back to a
  `tailwindcss` on PATH or returns a clear error. C ABI
  `pathland_tailwind_compile(default, override, classes) -> char*` returns the
  compiled CSS (or a `PATHLAND_TAILWIND_ERROR: …` message). `THIRD_PARTY_NOTICES`
  covers Tailwind (MIT) + Inter (OFL). The real-binary compile is exercised in
  the P2a test pass (fetch + run); the machinery + assembly are unit-tested.
- **C ABI cdylib** (`pathland_html_render` / `_render_fragment` /
  `_tailwind_compile` / `_free`) for cross-language hosts (Java JNA shim).

## Not implemented / gaps

- `SHAPE` `Path` renders as an SVG placeholder (no path data wire property).
- GAUGE/SHAPE visuals are CSS approximations, not pixel-exact.

## Verified by

`cargo test -p pathland-render-html` — 22 headless render tests (components,
properties, composite, event attrs, `days_to_date`, network-decoded frames).