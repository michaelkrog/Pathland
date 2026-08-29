# pathland-render-html (Java) — implementation status

**Last updated:** August 29, 2026

The **pure-function SSR HTML renderer** (`com.pathland.render.html`). Protocol
contract: `spec/`.

## Implemented

- Applies `Frame` deltas to a retained node map and renders HTML fragments /
  documents (`applyFrame`, `render`, `renderFragment`).
- **Components rendered**: `VSTACK`/`HSTACK`/`LAZY_VSTACK`/`LAZY_HSTACK`
  (flex stacks), `GRID`/`LAZY_VGRID`/`LAZY_HGRID` (CSS grid), `SCROLLVIEW`
  (overflow), `TEXT`, `BUTTON`, `COLOR` (layout-greedy fill), `SHAPE`
  (Rectangle/Circle/RoundedRectangle via `SHAPE_KIND`), `TOGGLE`
  (switch/checkbox via `TOGGLE_STYLE`), `SPACER`, `SLIDER`, `STEPPER`,
  `TEXT_FIELD`, `TEXT_EDITOR` (textarea), `PROGRESS_VIEW` (`<progress>` /
  spinner), `GAUGE`, `DIVIDER` (`<hr>`), `PICKER` (`<select>`),
  `MENU`, `COLOR_PICKER` (`<input type="color">`), `DATE_PICKER`
  (`<input type="date">`; `STYLE::SET_DATE` applied). Unknown components render
  their children.
- Border/padding styling from properties.

## Not implemented / gaps

- No `IMAGE`, no `STYLE::SET_DESIGN_TOKEN` handling; the property set applied
  to CSS is a subset of the Rust `pathland-render-html` (the fuller reference).

## Verified by

`mvn test -pl pathland-render-html` — HTML renderer tests.