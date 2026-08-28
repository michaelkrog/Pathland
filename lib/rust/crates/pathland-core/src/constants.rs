//! Protocol constants: categories, commands, component types, value types, flags.
//!
//! These constants are part of the wire protocol (see `spec/OPCODE.md`) and MUST
//! NOT be renumbered once released. Component types were renumbered pre-release
//! to the grouped ranges in `spec/PRIMITIVES.md` (wire version stays 1).

/// Opcode categories (`Category` field, u8).
pub mod category {
    /// Tree mutations (guest → host): node create/delete/insert/remove/move.
    pub const TREE: u8 = 0x01;
    /// Properties and design tokens (guest → host): the constraint properties
    /// (spacing, padding, alignment, …) that native renderers use to lay out
    /// native elements. The engine does NOT emit rects.
    pub const STYLE: u8 = 0x02;
    /// Raw input events (host → guest): pointer down/move/up, key down/up.
    pub const EVENT: u8 = 0x03;
    /// Control (both directions): reset, environment, custom data.
    pub const META: u8 = 0x04;
}

/// Commands within the `TREE` category.
pub mod tree {
    /// `A=nodeId, B=componentType (u16, low)`
    pub const CREATE_NODE: u8 = 0x01;
    /// `A=nodeId`
    pub const DELETE_NODE: u8 = 0x02;
    /// `A=parentId, B=childId, C=index` (append is `C = u32::MAX`, see [`crate::APPEND`])
    pub const INSERT_CHILD: u8 = 0x03;
    /// `A=parentId, B=childId`
    pub const REMOVE_CHILD: u8 = 0x04;
    /// `A=parentId, B=childId, C=newIndex` (append is `C = u32::MAX`, see [`crate::APPEND`])
    pub const MOVE_CHILD: u8 = 0x05;
}

/// Commands within the `STYLE` category.
pub mod style {
    /// `A=nodeId, B=(valueType << 16) | propertyId, C=value`
    pub const SET_PROPERTY: u8 = 0x01;
    /// `A=arenaRef (path), B=valueType (u8), C=value`
    pub const SET_DESIGN_TOKEN: u8 = 0x02;
    /// `A=nodeId, B=arenaRef (utf8)`
    pub const SET_TEXT: u8 = 0x03;
    /// **Draft.** `A=nodeId, B=days since epoch (I32), C=millis of day (U32)` —
    /// set a node's date value (e.g. a `DATE_PICKER`); see
    /// `spec/PRIMITIVES.md` / `spec/OPCODE.md`.
    pub const SET_DATE: u8 = 0x04;
}

/// Commands within the `EVENT` category.
///
/// Events are **raw inputs** (host → guest), each carrying a host-resolved
/// `targetId`. High-level interpretations (tap, drag, long-press) are built by
/// the guest/app from these raw inputs and are NOT part of the protocol.
pub mod event {
    /// `A=targetId, B=x (f32), C=y (f32)` (Flags `POINTER_SECONDARY`)
    pub const POINTER_DOWN: u8 = 0x01;
    /// `A=targetId, B=x (f32), C=y (f32)` (Flags `HOVER_ENTER` / `HOVER_LEAVE`)
    pub const POINTER_MOVE: u8 = 0x02;
    /// `A=targetId, B=x (f32), C=y (f32)` (Flags `POINTER_SECONDARY`)
    pub const POINTER_UP: u8 = 0x03;
    /// `A=targetId, B=keyCode (u16, low), C=modifiers (u8, low)` (Flags `KEY_REPEAT`)
    pub const KEY_DOWN: u8 = 0x04;
    /// `A=targetId, B=keyCode (u16, low), C=modifiers (u8, low)`
    pub const KEY_UP: u8 = 0x05;
    /// `A=targetId, B=value (f32)` — a control's value changed (host → guest).
    /// The renderer resolves the control's semantic value (e.g. a slider thumb
    /// dragged to a point on its track); the guest/app writes it into its state.
    pub const VALUE_CHANGED: u8 = 0x06;
    /// `A=targetId, B=string offset` — a text field's value changed (host →
    /// guest). The new text lives in the batch's string section, referenced by
    /// the *relative* offset in `B` (the same convention as `STYLE::SET_TEXT`).
    pub const TEXT_CHANGED: u8 = 0x07;
    /// **Draft.** `A=targetId, B=focused (0/1)` — a node gained/lost focus.
    pub const FOCUS_CHANGED: u8 = 0x08;
    /// **Draft.** `A=targetId, B=editing (0/1)` — an editing session began/ended.
    pub const EDITING_CHANGED: u8 = 0x09;
    /// **Draft.** `A=targetId, B=0` — the user committed a field (onSubmit).
    pub const SUBMIT: u8 = 0x0A;
    /// **Draft.** `A=targetId, B=offsetX (f32), C=offsetY (f32)` — scroll offset.
    pub const SCROLL: u8 = 0x0B;
    /// **Draft.** `A=targetId, B=deltaX (f32), C=deltaY (f32)` — wheel/trackpad.
    pub const WHEEL: u8 = 0x0C;
    /// **Draft.** `A=targetId, B=days since epoch (I32), C=millis of day (U32)`
    /// — a `DATE_PICKER`'s value changed (matches `STYLE::SET_DATE`).
    pub const DATE_CHANGED: u8 = 0x0D;
}

/// Commands within the `META` category.
pub mod meta {
    /// Host must clear all rendered output.
    pub const RESET: u8 = 0x01;
    /// `A=viewportWidth (f32), B=viewportHeight (f32)` (host → guest)
    pub const ENVIRONMENT: u8 = 0x02;
}

/// Flag bits used across categories.
pub mod flag {
    /// `POINTER_DOWN` / `POINTER_UP`: secondary button (bit 0).
    pub const POINTER_SECONDARY: u16 = 0x0001;
    /// `POINTER_MOVE`: pointer is entering/hovering (bit 0).
    pub const HOVER_ENTER: u16 = 0x0001;
    /// `POINTER_MOVE`: pointer is leaving (bit 1).
    pub const HOVER_LEAVE: u16 = 0x0002;
    /// `KEY_DOWN`: key repeat (bit 1).
    pub const KEY_REPEAT: u16 = 0x0002;
}

/// Bits for the `EVENT_LISTENERS` semantic property (a u32 bitmask).
///
/// Each bit requests that a renderer attach native input recognition for the
/// matching raw-input event and report it for that node — so any element (not
/// just a button) can emit raw events. Bits are independent of the `EVENT`
/// command ids; more event kinds can be added later.
pub mod listener {
    /// `POINTER_DOWN` events (bit 0).
    pub const POINTER_DOWN: u32 = 1 << 0;
    /// `POINTER_MOVE` events (bit 1).
    pub const POINTER_MOVE: u32 = 1 << 1;
    /// `POINTER_UP` events (bit 2).
    pub const POINTER_UP: u32 = 1 << 2;
    /// `KEY_DOWN` events (bit 3).
    pub const KEY_DOWN: u32 = 1 << 3;
    /// `KEY_UP` events (bit 4).
    pub const KEY_UP: u32 = 1 << 4;
    /// **Draft.** `FOCUS_CHANGED` events (bit 5).
    pub const FOCUS: u32 = 1 << 5;
    /// **Draft.** `EDITING_CHANGED` events (bit 6).
    pub const EDITING: u32 = 1 << 6;
    /// **Draft.** `SUBMIT` events (bit 7).
    pub const SUBMIT: u32 = 1 << 7;
    /// **Draft.** `SCROLL` events (bit 8).
    pub const SCROLL: u32 = 1 << 8;
    /// **Draft.** `WHEEL` events (bit 9).
    pub const WHEEL: u32 = 1 << 9;

    /// All pointer events (down + move + up).
    pub const POINTER: u32 = POINTER_DOWN | POINTER_MOVE | POINTER_UP;
}

/// Bits for the `BORDER_EDGES` style property (a u32 bitmask).
///
/// Each bit selects one edge of a node's border. `LEADING`/`TRAILING` are
/// direction-aware; a renderer resolves them to physical `left`/`right`
/// according to its layout direction (LTR by default).
pub mod border_edges {
    /// Top edge (bit 0).
    pub const TOP: u32 = 1 << 0;
    /// Leading edge (bit 1) — physical left in LTR.
    pub const LEADING: u32 = 1 << 1;
    /// Bottom edge (bit 2).
    pub const BOTTOM: u32 = 1 << 2;
    /// Trailing edge (bit 3) — physical right in LTR.
    pub const TRAILING: u32 = 1 << 3;

    /// All four edges.
    pub const ALL: u32 = TOP | LEADING | BOTTOM | TRAILING;
}

/// Value types for `STYLE` properties (u8, encoded in the high byte of `B`).
pub mod value_type {
    pub const U8: u8 = 0x01;
    pub const U32: u8 = 0x02;
    pub const I32: u8 = 0x03;
    pub const F32: u8 = 0x04;
    pub const STRING: u8 = 0x05;
    pub const ENUM: u8 = 0x06;
    pub const COLOR: u8 = 0x07;
    pub const DESIGN_TOKEN: u8 = 0x08;
}

/// Component types (u16, encoded in the low half of `B` of `TREE::CREATE_NODE`).
///
/// IDs are grouped into three definitive ranges (see `spec/PRIMITIVES.md`):
/// Primitive Drawing `0x01`–`0x0F`, Layout & Container `0x10`–`0x1F`, Semantic
/// Control `0x20`–`0x2F`, plus the utility `COMMENT` at `0x7F`. Renumbered
/// pre-release (wire version stays 1).
pub mod component_type {
    // ── Primitive Drawing & Visual Nodes (0x01–0x0F) ────────────────────────
    /// Standard styled text display.
    pub const TEXT: u16 = 0x01;
    /// Raster, vector, or system icon asset.
    pub const IMAGE: u16 = 0x02;
    /// **Draft.** Solid color / layout-filling background view.
    pub const COLOR: u16 = 0x03;
    /// **Draft.** Vector geometry (`SHAPE_KIND` selects the shape).
    pub const SHAPE: u16 = 0x04;
    /// **Draft.** Axis-aligned separator line.
    pub const DIVIDER: u16 = 0x05;
    /// Flexible expanding layout filler.
    pub const SPACER: u16 = 0x06;
    /// **Draft.** Determinate progress or activity indicator.
    pub const PROGRESS_VIEW: u16 = 0x07;
    /// **Draft.** Range meter against a scale (read-only).
    pub const GAUGE: u16 = 0x08;
    // 0x09–0x0F reserved (future drawing nodes).

    // ── Layout & Container Primitives (0x10–0x1F) ───────────────────────────
    /// Vertical flex stack.
    pub const VSTACK: u16 = 0x10;
    /// Horizontal flex stack.
    pub const HSTACK: u16 = 0x11;
    /// **Draft.** Depth-overlapping layer stack.
    pub const ZSTACK: u16 = 0x12;
    /// Static 2D matrix grid (eagerly rendered).
    pub const GRID: u16 = 0x13;
    /// Scrollable content container.
    pub const SCROLLVIEW: u16 = 0x14;
    /// **Draft.** Virtualized vertical grid.
    pub const LAZY_VGRID: u16 = 0x15;
    /// **Draft.** Virtualized horizontal grid.
    pub const LAZY_HGRID: u16 = 0x16;
    // 0x17–0x1A reserved (formerly composite views, removed).
    /// **Draft.** Virtualized vertical stack.
    pub const LAZY_VSTACK: u16 = 0x1B;
    /// **Draft.** Virtualized horizontal stack.
    pub const LAZY_HSTACK: u16 = 0x1C;
    // 0x1D–0x1F reserved (future layout nodes).

    // ── Semantic Control Nodes (0x20–0x2F) ──────────────────────────────────
    /// Action trigger control.
    pub const BUTTON: u16 = 0x20;
    /// Single-line text input (secure variant via `IS_SECURE`).
    pub const TEXT_FIELD: u16 = 0x21;
    /// **Draft.** Multi-line text editing area.
    pub const TEXT_EDITOR: u16 = 0x22;
    // 0x23 reserved.
    /// Boolean control; the visual variant is `TOGGLE_STYLE`
    /// (`Switch`/`Checkbox`/`Button`).
    pub const TOGGLE: u16 = 0x24;
    /// Continuous or stepped numeric range control.
    pub const SLIDER: u16 = 0x25;
    /// **Draft.** Discrete increment/decrement control.
    pub const STEPPER: u16 = 0x26;
    /// **Draft.** Date & time selection control (`STYLE::SET_DATE` value).
    pub const DATE_PICKER: u16 = 0x27;
    /// **Draft.** Selection control (options are child nodes).
    pub const PICKER: u16 = 0x28;
    /// **Draft.** Contextual action trigger + popover container.
    pub const MENU: u16 = 0x29;
    /// **Draft.** Native system color picker control.
    pub const COLOR_PICKER: u16 = 0x2A;
    // 0x2B–0x2F reserved (future semantic controls).

    /// Opaque/debug node; renderers ignore it (no native element).
    pub const COMMENT: u16 = 0x7F;
}

/// Property IDs (u16, encoded in the low half of `B` of `STYLE::SET_PROPERTY`).
///
/// IDs are specified in `spec/OPCODE.md` (carried forward from the historical protocol).
pub mod property_id {
    // Stack
    pub const SPACING: u16 = 0x0001;
    pub const ALIGNMENT: u16 = 0x0002;
    // 0x0003 reserved (formerly JUSTIFICATION; main-axis distribution is
    // expressed via a spacer element instead).
    // 0x0004 reserved (formerly PADDING; now a styling modifier at 0x1011).
    pub const CONTENT_MARGINS: u16 = 0x0005;
    // Text
    pub const TEXT: u16 = 0x000A;
    pub const LINE_LIMIT: u16 = 0x000B;
    pub const TEXT_ALIGNMENT: u16 = 0x000C;
    pub const TRUNCATION_MODE: u16 = 0x000D;
    // Style (0x1000 range)
    pub const BACKGROUND_COLOR: u16 = 0x1001;
    /// **Draft.** Image source (STRING: a resource name, file path, or URL).
    pub const IMAGE_SOURCE: u16 = 0x1002;
    pub const BORDER_WIDTH: u16 = 0x1003;
    pub const BORDER_COLOR: u16 = 0x1004;
    pub const BORDER_RADIUS: u16 = 0x1005;
    pub const PADDING_STYLE: u16 = 0x1006;
    pub const FONT_SIZE: u16 = 0x1007;
    pub const FONT_WEIGHT: u16 = 0x1008;
    pub const FONT_FAMILY: u16 = 0x1009;
    pub const COLOR: u16 = 0x100A;
    pub const WIDTH: u16 = 0x100B;
    pub const HEIGHT: u16 = 0x100C;
    pub const OPACITY: u16 = 0x100D;
    pub const VISIBLE: u16 = 0x100E;
    pub const Z_INDEX: u16 = 0x100F;
    pub const CLIPS_TO_BOUNDS: u16 = 0x1010;
    pub const PADDING: u16 = 0x1011;
    pub const PADDING_TOP: u16 = 0x1012;
    pub const PADDING_RIGHT: u16 = 0x1013;
    pub const PADDING_BOTTOM: u16 = 0x1014;
    pub const PADDING_LEFT: u16 = 0x1015;
    /// `BORDER_EDGES` — a u32 bitmask (see [`crate::border_edges`]) selecting
    /// which edges of a node's border are drawn.
    pub const BORDER_EDGES: u16 = 0x1016;
    // Semantic (0x2000 range)
    pub const ROLE: u16 = 0x2001;
    pub const STATE: u16 = 0x2002;
    pub const ENABLED: u16 = 0x2003;
    pub const SELECTED: u16 = 0x2004;
    /// `EVENT_LISTENERS` — a u32 bitmask (see [`crate::listener`]) declaring
    /// which raw-input events a node wants the renderer to report. This is the
    /// declarative signal the application sets so a renderer attaches native
    /// input recognition to any element — not just buttons.
    pub const EVENT_LISTENERS: u16 = 0x2005;
    /// The current value of a value-bearing control (e.g. a `SLIDER`).
    pub const VALUE: u16 = 0x2006;
    /// The inclusive minimum of a value-bearing control's range (e.g. a `SLIDER`).
    pub const MIN_VALUE: u16 = 0x2007;
    /// The inclusive maximum of a value-bearing control's range (e.g. a `SLIDER`).
    pub const MAX_VALUE: u16 = 0x2008;
    /// The caption label of a `TEXT_FIELD` (a `STRING` property).
    pub const LABEL: u16 = 0x200A;
    /// The placeholder text of a `TEXT_FIELD` (a `STRING` property).
    pub const PROMPT: u16 = 0x200B;
    /// **Draft.** Bound callback id; gates event delivery for this node.
    pub const ACTION_ID: u16 = 0x2016;
    /// **Draft.** Two-way binding id (control value ↔ app state).
    pub const BINDING_ID: u16 = 0x2017;
    /// **Draft.** Visual style token for a `TOGGLE` (F32 enum code):
    /// `Switch`=0, `Checkbox`=1, `Button`=2.
    pub const TOGGLE_STYLE: u16 = 0x2018;
}

/// The protocol value type for a property id.
///
/// Color-valued properties (COLOR, BACKGROUND_COLOR, BORDER_COLOR) are emitted
/// with the `COLOR` value type; `EVENT_LISTENERS` and `BORDER_EDGES` are raw
/// `U32` bitmasks; `LABEL`/`PROMPT`/`FONT_FAMILY` are `STRING`; `LINE_LIMIT`,
/// `ACTION_ID`, and `BINDING_ID` are `U32`; all other constraint/style
/// properties are `F32` (enum-valued properties like `ALIGNMENT`/`TOGGLE_STYLE`
/// carry their numeric code as an `F32`). See `spec/MODIFIERS.md` for the
/// canonical mapping.
pub fn value_type_for(prop: u16) -> u8 {
    match prop {
        property_id::COLOR
        | property_id::BACKGROUND_COLOR
        | property_id::BORDER_COLOR => value_type::COLOR,
        property_id::EVENT_LISTENERS | property_id::BORDER_EDGES => value_type::U32,
        property_id::SELECTED => value_type::U8,
        property_id::LABEL | property_id::PROMPT | property_id::FONT_FAMILY | property_id::IMAGE_SOURCE => value_type::STRING,
        property_id::LINE_LIMIT | property_id::ACTION_ID | property_id::BINDING_ID => value_type::U32,
        _ => value_type::F32,
    }
}

/// Special size constants for `WIDTH` / `HEIGHT`.
pub mod size {
    /// Fill the available space (parent main-axis remainder).
    pub const FILL: f32 = -1.0;
    /// Hug content (size to the intrinsic content).
    pub const HUG_CONTENT: f32 = -2.0;
}

/// Sentinel for append positions (`index = u32::MAX`).
pub const APPEND: u32 = u32::MAX;
