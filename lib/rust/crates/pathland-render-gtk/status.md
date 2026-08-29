# pathland-render-gtk — implementation status

**Last updated:** August 28, 2026

The **GTK4 renderer**: maps opcode frames incrementally onto native GTK widgets
(shared-memory desktop path). Protocol contract: `spec/`.

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
mapping (headless; widget construction is exercised without a display).