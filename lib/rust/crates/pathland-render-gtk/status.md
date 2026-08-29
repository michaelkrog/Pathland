# pathland-render-gtk — implementation status

**Last updated:** August 28, 2026

The **GTK4 renderer**: maps opcode frames incrementally onto native GTK widgets
(shared-memory desktop path). Protocol contract: `spec/`.

## Implemented

- **Components → widgets** (`widget_kind`/`build_widget`):
  - `VSTACK`/`HSTACK` → `GtkBox` (with `SPACING`/`ALIGNMENT`/`PADDING`),
  - `TEXT` → `GtkLabel` (text + `FONT_SIZE`/`COLOR` via Pango),
  - `BUTTON` → `GtkButton` (label),
  - `GRID` → `GtkGrid` (row-major cells from child index + `WIDTH` column count),
  - `SCROLLVIEW` → `GtkScrolledWindow` (single child),
  - `ZSTACK` → `GtkOverlay`,
  - `SPACER` → expanding box,
  - `IMAGE` → `GtkPicture` (`IMAGE_SOURCE` from the frame string section).
  Unknown components → blank `GtkLabel`.
- **Container reconciliation** generalized to all containers (diff-guarded).
- **Host reader** (`host.rs`): `RenderTree` + resolved `STRING` properties.
- **Events**: pointer `POINTER_DOWN`/`POINTER_MOVE`/`POINTER_UP` via
  `GestureClick`/`EventControllerMotion`, driven by `desired_listeners`
  (buttons by default + `EVENT_LISTENERS`).

## Not implemented / gaps

- **Tier 2 (pending)**: `TOGGLE`/`SLIDER`/`TEXT_FIELD`/`TEXT_EDITOR` native
  tokens, composite-override mode (controls with children), `VALUE_CHANGED` /
  `TEXT_CHANGED` emission, `ACTION_ID`/`BINDING_ID` event-gating.
- Style breadth: `VISIBLE`, `OPACITY`, `BACKGROUND_COLOR`, `BORDER_*`,
  `FONT_WEIGHT`/`FONT_FAMILY` not applied to widgets.
- Draft components (`COLOR`, `SHAPE`, `DIVIDER`, `PROGRESS_VIEW`, `GAUGE`,
  `LAZY_*`, `TEXT_EDITOR`, `STEPPER`, `DATE_PICKER`, `PICKER`, `MENU`,
  `COLOR_PICKER`) have no GTK mapping yet.

## Verified by

`cargo test -p pathland-render-gtk` — layout mapping, container kinds,
`widget_kind`, string resolution (headless; widget construction is exercised
without a display).