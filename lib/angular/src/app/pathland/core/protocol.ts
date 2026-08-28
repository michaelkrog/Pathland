/**
 * Pathland wire-protocol constants — the TypeScript mirror of
 * `pathland_core::constants` (see `lib/rust/crates/pathland-core/src/constants.rs`
 * and `spec/OPCODE.md`). These IDs are part of the wire format and must not change.
 */
export const CATEGORY = {
  TREE: 0x01,
  STYLE: 0x02,
  EVENT: 0x03,
  META: 0x04,
} as const;

export const TREE = {
  CREATE_NODE: 0x01,
  DELETE_NODE: 0x02,
  INSERT_CHILD: 0x03,
  REMOVE_CHILD: 0x04,
  MOVE_CHILD: 0x05,
} as const;

export const STYLE = {
  SET_PROPERTY: 0x01,
  SET_DESIGN_TOKEN: 0x02,
  SET_TEXT: 0x03,
} as const;

export const EVENT = {
  POINTER_DOWN: 0x01,
  POINTER_MOVE: 0x02,
  POINTER_UP: 0x03,
  KEY_DOWN: 0x04,
  KEY_UP: 0x05,
  VALUE_CHANGED: 0x06,
  TEXT_CHANGED: 0x07,
} as const;

export const VALUE_TYPE = {
  U8: 0x01,
  U32: 0x02,
  I32: 0x03,
  F32: 0x04,
  STRING: 0x05,
  ENUM: 0x06,
  COLOR: 0x07,
  DESIGN_TOKEN: 0x08,
} as const;

/** Component types (`u16`, low half of `B` in `TREE::CREATE_NODE`). */
export const COMPONENT = {
  HSTACK: 0x0001,
  VSTACK: 0x0002,
  TEXT: 0x0003,
  BUTTON: 0x0004,
  IMAGE: 0x0005,
  SWITCH: 0x0006,
  TEXT_FIELD: 0x0007,
  SPACER: 0x0008,
  SCROLLVIEW: 0x0009,
  LIST: 0x000a,
  GRID: 0x000b,
  COMMENT: 0x000c,
  CHECKBOX: 0x000d,
  SLIDER: 0x000e,
} as const;

/** Property ids (`u16`, low half of `B` in `STYLE::SET_PROPERTY`). */
export const PROPERTY = {
  SPACING: 0x0001,
  ALIGNMENT: 0x0002,
  CONTENT_MARGINS: 0x0005,
  TEXT: 0x000a,
  LINE_LIMIT: 0x000b,
  TEXT_ALIGNMENT: 0x000c,
  TRUNCATION_MODE: 0x000d,
  BACKGROUND_COLOR: 0x1001,
  BORDER_WIDTH: 0x1003,
  BORDER_COLOR: 0x1004,
  BORDER_RADIUS: 0x1005,
  PADDING_STYLE: 0x1006,
  FONT_SIZE: 0x1007,
  FONT_WEIGHT: 0x1008,
  FONT_FAMILY: 0x1009,
  COLOR: 0x100a,
  WIDTH: 0x100b,
  HEIGHT: 0x100c,
  OPACITY: 0x100d,
  VISIBLE: 0x100e,
  Z_INDEX: 0x100f,
  CLIPS_TO_BOUNDS: 0x1010,
  PADDING: 0x1011,
  PADDING_TOP: 0x1012,
  PADDING_RIGHT: 0x1013,
  PADDING_BOTTOM: 0x1014,
  PADDING_LEFT: 0x1015,
  BORDER_EDGES: 0x1016,
  ROLE: 0x2001,
  STATE: 0x2002,
  ENABLED: 0x2003,
  SELECTED: 0x2004,
  EVENT_LISTENERS: 0x2005,
  VALUE: 0x2006,
  MIN_VALUE: 0x2007,
  MAX_VALUE: 0x2008,
  LABEL: 0x200a,
  PROMPT: 0x200b,
} as const;

/** `EVENT_LISTENERS` bitmask bits. */
export const LISTENER = {
  POINTER_DOWN: 1 << 0,
  POINTER_MOVE: 1 << 1,
  POINTER_UP: 1 << 2,
  KEY_DOWN: 1 << 3,
  KEY_UP: 1 << 4,
} as const;

/** `BORDER_EDGES` bitmask bits. */
export const BORDER_EDGE = {
  TOP: 1 << 0,
  LEADING: 1 << 1,
  BOTTOM: 1 << 2,
  TRAILING: 1 << 3,
  ALL: 0x0f,
} as const;

/** Special `WIDTH`/`HEIGHT` size constants. */
export const SIZE = {
  FILL: -1.0,
  HUG_CONTENT: -2.0,
} as const;

/** `Alignment` wire values (protocol ENUM). */
export const ALIGNMENT = {
  LEADING: 0,
  CENTER: 1,
  TRAILING: 2,
  FILL: 3,
} as const;

/** `FontWeight` wire values (protocol ENUM). */
export const FONT_WEIGHT = {
  LIGHT: 0,
  REGULAR: 1,
  MEDIUM: 2,
  SEMIBOLD: 3,
  BOLD: 4,
} as const;