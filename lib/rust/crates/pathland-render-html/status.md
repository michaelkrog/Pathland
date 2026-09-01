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

- **Tailwind class emission — finite enum surface only**: stacks/grids/alignment,
  text alignment/case, truncate/underline/strikethrough/italic/font-design/
  invert/pointer-events/overflow, `hidden`, `absolute/relative/inset-0`, the
  `WIDTH`/`HEIGHT` FILL/HUG sentinels (`w-full`/`w-fit`/`h-full`/`h-fit`), and
  `grid-cols-N` (naturally bounded). These are all **protocol-enum-derived or
  fixed** values.
- **Arbitrary-number (dp/point) styling renders inline**: spacing, padding,
  margins, size, offset/position, rotation, scale, filters, opacity, z-index,
  border-radius, shadow — emitted as inline `style` (e.g. `gap:12px`,
  `padding:8px`, `rotate(90deg)`), because Tailwind can only statically safelist
  finite classes and dp values are unbounded. **1 dp = 1 CSS px** (renderer
  interpretation; SwiftUI-style points).
- **Static, complete safelist (`tw::safelist()`)** derived only from what the
  protocol can emit as enum/finite classes — compiled once at startup, never
  changes, small (~50–80 rules). Arbitrary dp values contribute no class/CSS.
- **`compileTailwind` owns the safelist internally**: `pathland_tailwind_compile`
  (and Java `compileTailwind`) take `(default_css, override_css)` — the `classes`
  parameter was dropped. The renderer assembles its own safelist. No host
  re-derives/replicates it.
- **Tailwind v4 integration (Phase 3, landed)**: `tailwind.rs` provides the
  bundled default `@theme` config (Inter, OFL) + `assemble_input(default,
  override, classes)` (pure, tested) + `compile(...)` that spawns the compiler
  and returns the CSS. The compiler is the **per-platform standalone binary,
  feature-gated (`tailwind-embed`)**: build.rs embeds it via `include_bytes!`
  (clear panic if missing); `scripts/fetch-tailwind.mjs` fetches the real
  `tailwindcss` v4.x standalone binary (per-platform, offline-capable) into
  `vendor/<target-triple>/`. With the feature off, `compile` falls back to a
  `tailwindcss` on PATH or returns a clear error. C ABI
  `pathland_tailwind_compile(default, override) -> char*` returns the
  compiled CSS (or a `PATHLAND_TAILWIND_ERROR: …` message). `THIRD_PARTY_NOTICES`
  covers Tailwind (MIT) + Inter (OFL).
  - **Robustness**: `compile()` detects "exited 0 but no output file" and
    "empty output" and returns a clear error; `extract_embedded()` always
    rewrites the cached binary (never reuses a stale/placeholder file); temp
    in/out filenames are unique per call (no parallel-compile collision).
  - **Verified end-to-end**: with `tailwind-embed` enabled and the real binary
    embedded, the Spring fat jar's `/tailwind.css` returns compiled Tailwind
    v4.3.3 CSS with no `java.library.path` — the jar is self-contained.
- **C ABI cdylib** (`pathland_html_render` / `_render_fragment` /
  `_tailwind_compile` / `_free`) for cross-language hosts (Java JNA shim).

## Not implemented / gaps

- `SHAPE` `Path` renders as an SVG placeholder (no path data wire property).
- GAUGE/SHAPE visuals are CSS approximations, not pixel-exact.

## Verified by

`cargo test -p pathland-render-html` — 22 headless render tests (components,
properties, composite, event attrs, `days_to_date`, network-decoded frames).