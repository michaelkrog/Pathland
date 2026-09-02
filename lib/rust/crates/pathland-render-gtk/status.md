# pathland-render-gtk — implementation status

**Last updated:** September 2, 2026

The **GTK4 renderer**: maps opcode frames incrementally onto native GTK widgets
(shared-memory desktop path). Protocol contract: `spec/`. Design-token contract:
`spec/TOKENS.md`.

## Implemented

- **Components → widgets** (`widget_kind`/`build_widget`):
  - `VSTACK`/`HSTACK`/`LAZY_VSTACK`/`LAZY_HSTACK` → `GtkBox` (spacing/alignment/
    padding/content-margins),
  - `TEXT` → `GtkLabel` (text, `FONT_SIZE`/`FONT_WEIGHT`/`COLOR` via Pango),
  - `BUTTON` → `GtkButton` (label; composite body when it has children),
  - `GRID`/`LAZY_VGRID`/`LAZY_HGRID` → `GtkGrid` (row-major cells from child
    index + `WIDTH` column count),
  - `SCROLLVIEW` → `GtkScrolledWindow` (single child),
  - `ZSTACK` → `GtkOverlay`,
  - `SPACER` → expanding box, `IMAGE` → `GtkPicture` (`IMAGE_SOURCE`),
  - `TOGGLE` → `GtkSwitch`/`GtkCheckButton`/`GtkToggleButton` by `TOGGLE_STYLE`
    (`SELECTED` ↔ active),
  - `SLIDER` → `GtkScale` (`VALUE`/`MIN`/`MAX`/`STEP`),
  - `TEXT_FIELD` → `GtkEntry` (`LABEL`/`PROMPT`/`IS_SECURE`),
  - `TEXT_EDITOR` → `GtkTextView` (multi-line),
  - `COLOR` → `GtkDrawingArea` (solid fill), `SHAPE` → `GtkDrawingArea`
    (`SHAPE_KIND`), `DIVIDER` → `GtkSeparator`,
  - `PROGRESS_VIEW` → `GtkProgressBar`/`GtkSpinner`,
  - `GAUGE` → `GtkLevelBar`, `STEPPER` → `GtkSpinButton`,
  - `DATE_PICKER` → `GtkCalendar`, `PICKER` → `GtkDropDown` (option children +
    `SELECTION`), `MENU` → `GtkMenuButton`, `COLOR_PICKER` → `GtkColorButton`.
  Unknown components → blank `GtkLabel`.
- **Container + composite reconciliation** (diff-guarded): stacks/grid/scroll/
  overlay children, and **Composite Override Mode** for `BUTTON`/`TOGGLE`/`MENU`
  with children (custom body wrapped in the native button shell).
- **Style properties**: `VISIBLE`, `OPACITY`, `WIDTH`/`HEIGHT`,
  `CONTENT_MARGINS`, `PADDING` + per-edge, `BACKGROUND_COLOR`, `BORDER_WIDTH`/
  `COLOR`/`RADIUS`, `FONT_FAMILY`/`FONT_WEIGHT` (CSS provider), `COLOR`,
  `FONT_SIZE`.
- **Events**: pointer `POINTER_DOWN`/`MOVE`/`UP` via `GestureClick`/
  `EventControllerMotion` (`EVENT_LISTENERS`-driven), plus **value/text events**
  (`VALUE_CHANGED` from toggle/slider/picker, `TEXT_CHANGED` from text field)
  **gated by `BINDING_ID`** (transport-aware event guards), sent through the
  two-way event arena.
- **Design tokens / theming (spec/TOKENS.md renderer contract)**:
  - `STYLE::SET_DESIGN_TOKEN` overrides are stored (`host.rs`), base + `dark.*`
    split by path prefix; STRING-valued overrides resolve the value string from
    the arena.
  - `DESIGN_TOKEN`-typed `SET_PROPERTY` values record the token path
    (`HostNode::token_refs`) and **resolve at apply time** against the theme,
    the active scheme, and the parent-fallback chain into concrete
    `properties`/`strings` (`RenderTree::resolve_tokens`, reusing
    `pathland_core::tokens`).
  - **Tier-1 default tables** (light + dark) in `host.rs`
    (`concrete_default_tables`) — concrete platform-appropriate fallbacks,
    **enriched with GTK-native theme colors** (`tokens.rs`:
    `StyleContext::lookup_color` of `@theme_*`/`@borders`/`@success_color`…)
    from the first widget's style context (headless → concrete fallback).
  - **Scheme detection** from the native GTK variant
    (`gtk::Settings` `prefer-dark` + `-dark` theme name); a notify handler
    calls `GtkRenderer::set_scheme`, which re-enriches native defaults and
    re-resolves + re-applies every token-referencing widget. Scheme is never
    carried by the protocol.
  - The generative `space.<N>` family resolves `space.base` × N.
  - Since GTK CSS has no custom properties, tokens resolve to **concrete**
    values (rgba/px/Pango) before the existing CSS-provider / text-style paths.

## Not implemented / gaps

- `SHAPE` `Path`/rounded rendering is an approximation (rectangle/circle fill).
- `MENU` renders a menu button without a popover item list.
- No `ACTION_ID`-only gating (events require `BINDING_ID`).
- Composite bodies attach to button-like controls only; other controls ignore
  children.
- `LAZY_*` renders eagerly (no GTK windowing).

## Verified by

`cargo test -p pathland-render-gtk` — layout mapping, `widget_kind` (full
component map), container/composite kinds, string resolution, value type
mapping (headless; widget construction is exercised without a display), and
design tokens: `DESIGN_TOKEN` property refs resolve against concrete defaults,
`SET_DESIGN_TOKEN` overrides + `dark.*` + scheme change re-resolve, generative
`space.N`, and the GTK-native default enrichment (fallback path headless).