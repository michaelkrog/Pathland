//! Protocol constants: categories, commands, component types, value types, flags.
//!
//! These constants are part of the wire protocol (see `spec/OPCODE.md`) and MUST
//! NOT be renumbered once released.

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
    /// `A=parentId, B=childId, C=index` (Flags `INSERT_APPEND` = append)
    pub const INSERT_CHILD: u8 = 0x03;
    /// `A=parentId, B=childId`
    pub const REMOVE_CHILD: u8 = 0x04;
    /// `A=parentId, B=childId, C=newIndex` (Flags `INSERT_APPEND` = append)
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
    /// `INSERT_CHILD` / `MOVE_CHILD`: append (index = append).
    pub const INSERT_APPEND: u16 = 0x0001;
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

/// Component types (u16, encoded in the low half of `A` of `TREE::CREATE_NODE`).
///
/// IDs are specified in `spec/OPCODE.md` (carried forward from the historical protocol).
pub mod component_type {
    pub const HSTACK: u16 = 0x0001;
    pub const VSTACK: u16 = 0x0002;
    pub const TEXT: u16 = 0x0003;
    pub const BUTTON: u16 = 0x0004;
    pub const IMAGE: u16 = 0x0005;
    pub const SWITCH: u16 = 0x0006;
    pub const TEXT_FIELD: u16 = 0x0007;
    pub const SPACER: u16 = 0x0008;
    pub const SCROLLVIEW: u16 = 0x0009;
    pub const LIST: u16 = 0x000A;
    pub const GRID: u16 = 0x000B;
    pub const COMMENT: u16 = 0x000C;
    /// A checkbox-style boolean control (a toggle drawn as a square with a
    /// checkmark). Checked state is carried by [`property_id::SELECTED`].
    pub const CHECKBOX: u16 = 0x000D;
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
}

/// The protocol value type for a property id.
///
/// Color-valued properties (COLOR, BACKGROUND_COLOR, BORDER_COLOR) are emitted
/// with the `COLOR` value type; `EVENT_LISTENERS` and `BORDER_EDGES` are raw
/// `U32` bitmasks; all other constraint/style properties are `F32`.
pub fn value_type_for(prop: u16) -> u8 {
    match prop {
        property_id::COLOR
        | property_id::BACKGROUND_COLOR
        | property_id::BORDER_COLOR => value_type::COLOR,
        property_id::EVENT_LISTENERS | property_id::BORDER_EDGES => value_type::U32,
        property_id::SELECTED => value_type::U8,
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
