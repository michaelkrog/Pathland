# pathland-render-html (Rust) — implementation status

**Last updated:** August 28, 2026

The **server-side / remote-projection HTML renderer**: a pure function of the
opcode stream producing declarative HTML. Protocol contract: `spec/`.

## Implemented

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

## Not implemented / gaps

- `SHAPE` `Path` renders as an SVG placeholder (no path data wire property).
- GAUGE/SHAPE visuals are CSS approximations, not pixel-exact.

## Verified by

`cargo test -p pathland-render-html` — 22 headless render tests (components,
properties, composite, event attrs, `days_to_date`, network-decoded frames).