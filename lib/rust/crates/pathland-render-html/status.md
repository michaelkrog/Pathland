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
  `SELECTED`, `TOGGLE_STYLE`, `ENABLED`, `ROLE`/`STATE` (ARIA), plus
  `TEXT_CASE`, `FONT_STYLE`, `FONT_DESIGN`, `UNDERLINE`/`STRIKETHROUGH`,
  `CLIPS_TO_BOUNDS`, `ALLOWS_HIT_TESTING`, `COLOR_INVERT`.
- **Event surfacing**: `data-event-listeners` / `data-action-id` /
  `data-binding-id` attributes.
- `STYLE::SET_DATE` handled (days + millis-of-day → date/time).

## Design decision (decision A, September 2026): inline-all + built-in design system

Tailwind is **removed**. The renderer emits **everything inline** as CSS in a
single `style` attribute — no external compiler, no class system, no safelist:

- **All opcode properties render inline** (`style_css()` + `border_style()`),
  including the previously class-based enum surface (alignment, text alignment,
  text case, visible, font style/design, underline/strikethrough, clips-to-bounds,
  hit-testing, invert, truncation). **1 dp = 1 CSS px**.
- **`css::STYLE`** is a built-in `<style>` block injected by `render_document`,
  containing:
  - a **preflight reset** (vendored from Tailwind CSS, MIT — see
    `THIRD_PARTY_NOTICES`),
  - `:root` **design tokens** as CSS custom properties (`--pl-color-accent`,
    `--pl-color-surface`, `--pl-radius-*`, `--pl-font-sans`, button tokens),
    named to match the protocol design-token paths so `SET_DESIGN_TOKEN` can
    retheme the renderer,
  - `.pathland-button` (the prettified-button POC, with `prefers-color-scheme`
    dark mode) and `.pathland-*` component defaults (toggle switch, slider, text
    field/editor, stepper, spinner, gauge, menu) — the interactive/hover/focus/
    disabled states that can't be expressed inline.
- **`pathland_html_*` cdylib** (`pathland_html_render` / `_render_fragment` /
  `_free`) for cross-language hosts (Java JNA shim). The `_tailwind_compile`
  entry point, `tw.rs`, `tailwind.rs`, `build.rs`, `scripts/fetch-tailwind.mjs`,
  `vendor/`, and the `tailwind-embed` feature are **deleted**.

## Not implemented / gaps

- `SHAPE` `Path` renders as an SVG placeholder (no path data wire property).
- GAUGE/SHAPE visuals are CSS approximations, not pixel-exact.
- The Inter webfont is referenced by `--pl-font-sans` but **not yet bundled**;
  the CSS falls back to `system-ui` until the OFL-licensed woff2 is embedded
  (documented follow-up — see `THIRD_PARTY_NOTICES`).

## Verified by

`cargo test -p pathland-render-html` — 27 headless render tests (components,
properties, composite, event attrs, `days_to_date`, network-decoded frames,
inline-all styling, built-in CSS block contents).
