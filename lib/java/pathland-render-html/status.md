# pathland-render-html (Java) — implementation status

**Last updated:** August 29, 2026

The **pure-function SSR HTML renderer** (`com.pathland.render.html`). Protocol
contract: `spec/`.

## Implemented

- Applies `Frame` deltas to a retained node map and renders HTML fragments /
  documents (`applyFrame`, `render`, `renderFragment`).
- **Components rendered**: `VSTACK`/`HSTACK` (flex stacks), `TEXT`, `BUTTON`,
  `COLOR` (layout-greedy fill), `SHAPE` (Rectangle/Circle/RoundedRectangle via
  `SHAPE_KIND`), `TOGGLE` (switch/checkbox via `TOGGLE_STYLE`), `SPACER`,
  `SLIDER`, `TEXT_FIELD`. Unknown components render their children.
- Border/padding styling from properties.

## Not implemented / gaps

- No `IMAGE`, `DIVIDER`, `PROGRESS_VIEW`, `GAUGE`, `ZSTACK`, `GRID`,
  `SCROLLVIEW`, `LAZY_*`, `TEXT_EDITOR`, `STEPPER`, `DATE_PICKER`, `PICKER`,
  `MENU`, `COLOR_PICKER`.
- No `STYLE::SET_DATE` handling; limited property set vs the Rust
  `pathland-render-html` (which is the fuller reference).

## Verified by

`mvn test -pl pathland-render-html` — HTML renderer tests.