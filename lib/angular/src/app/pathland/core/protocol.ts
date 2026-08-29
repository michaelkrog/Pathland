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
  SET_DATE: 0x04,
} as const;

export const META = {
  RESET: 0x01,
  ENVIRONMENT: 0x02,
} as const;

export const EVENT = {
  POINTER_DOWN: 0x01,
  POINTER_MOVE: 0x02,
  POINTER_UP: 0x03,
  KEY_DOWN: 0x04,
  KEY_UP: 0x05,
  VALUE_CHANGED: 0x06,
  TEXT_CHANGED: 0x07,
  FOCUS_CHANGED: 0x08,
  EDITING_CHANGED: 0x09,
  SUBMIT: 0x0a,
  SCROLL: 0x0b,
  WHEEL: 0x0c,
  DATE_CHANGED: 0x0d,
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

/** Component types (`u16`, low half of `B` in `TREE::CREATE_NODE`) — spec ranges. */
export const COMPONENT = {
  TEXT: 0x01,
  IMAGE: 0x02,
  COLOR: 0x03,
  SHAPE: 0x04,
  DIVIDER: 0x05,
  SPACER: 0x06,
  PROGRESS_VIEW: 0x07,
  GAUGE: 0x08,
  VSTACK: 0x10,
  HSTACK: 0x11,
  ZSTACK: 0x12,
  GRID: 0x13,
  SCROLLVIEW: 0x14,
  LAZY_VGRID: 0x15,
  LAZY_HGRID: 0x16,
  LAZY_VSTACK: 0x1b,
  LAZY_HSTACK: 0x1c,
  BUTTON: 0x20,
  TEXT_FIELD: 0x21,
  TEXT_EDITOR: 0x22,
  TOGGLE: 0x24,
  SLIDER: 0x25,
  STEPPER: 0x26,
  DATE_PICKER: 0x27,
  PICKER: 0x28,
  MENU: 0x29,
  COLOR_PICKER: 0x2a,
  COMMENT: 0x7f,
} as const;

/** Property ids (`u16`, low half of `B` in `STYLE::SET_PROPERTY`) — spec values. */
export const PROPERTY = {
  SPACING: 0x0001,
  ALIGNMENT: 0x0002,
  CONTENT_MARGINS: 0x0005,
  SHAPE_KIND: 0x0006,
  TEXT: 0x000a,
  LINE_LIMIT: 0x000b,
  TEXT_ALIGNMENT: 0x000c,
  TRUNCATION_MODE: 0x000d,
  OFFSET_X: 0x000e,
  OFFSET_Y: 0x000f,
  POSITION_X: 0x0010,
  POSITION_Y: 0x0011,
  MIN_WIDTH: 0x0012,
  IDEAL_WIDTH: 0x0013,
  MAX_WIDTH: 0x0014,
  MIN_HEIGHT: 0x0015,
  IDEAL_HEIGHT: 0x0016,
  MAX_HEIGHT: 0x0017,
  FIXED_SIZE_HORIZONTAL: 0x0018,
  FIXED_SIZE_VERTICAL: 0x0019,
  LAYOUT_PRIORITY: 0x001a,
  ASPECT_RATIO: 0x001b,
  CONTENT_MODE: 0x001c,
  MINIMUM_SCALE_FACTOR: 0x001d,
  BACKGROUND_COLOR: 0x1001,
  IMAGE_SOURCE: 0x1002,
  BORDER_WIDTH: 0x1003,
  BORDER_COLOR: 0x1004,
  BORDER_RADIUS: 0x1005,
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
  FONT_STYLE: 0x1017,
  FONT_DESIGN: 0x1018,
  FONT_WIDTH: 0x1019,
  KERNING: 0x101a,
  TRACKING: 0x101b,
  BASELINE_OFFSET: 0x101c,
  LINE_SPACING: 0x101d,
  TEXT_CASE: 0x101e,
  UNDERLINE: 0x101f,
  STRIKETHROUGH: 0x1020,
  SHADOW_COLOR: 0x1021,
  SHADOW_RADIUS: 0x1022,
  SHADOW_X: 0x1023,
  SHADOW_Y: 0x1024,
  BLUR_RADIUS: 0x1025,
  SATURATION: 0x1026,
  CONTRAST: 0x1027,
  BRIGHTNESS: 0x1028,
  GRAYSCALE: 0x1029,
  HUE_ROTATION: 0x102a,
  COLOR_MULTIPLY: 0x102b,
  COLOR_INVERT: 0x102c,
  ROTATION_DEGREES: 0x102d,
  SCALE: 0x102e,
  ALLOWS_HIT_TESTING: 0x102f,
  TINT: 0x1030,
  ROLE: 0x2001,
  STATE: 0x2002,
  ENABLED: 0x2003,
  SELECTED: 0x2004,
  EVENT_LISTENERS: 0x2005,
  VALUE: 0x2006,
  MIN_VALUE: 0x2007,
  MAX_VALUE: 0x2008,
  STEP_VALUE: 0x2009,
  LABEL: 0x200a,
  PROMPT: 0x200b,
  CONTROL_SIZE: 0x200c,
  IS_SECURE: 0x200d,
  PROGRESS: 0x200e,
  IS_INDETERMINATE: 0x200f,
  SELECTION: 0x2010,
  COLOR_VALUE: 0x2012,
  DATE_PICKER_MODE: 0x2013,
  PICKER_STYLE: 0x2014,
  ACTION_ID: 0x2016,
  BINDING_ID: 0x2017,
  TOGGLE_STYLE: 0x2018,
} as const;

/** `EVENT_LISTENERS` bitmask bits. */
export const LISTENER = {
  POINTER_DOWN: 1 << 0,
  POINTER_MOVE: 1 << 1,
  POINTER_UP: 1 << 2,
  KEY_DOWN: 1 << 3,
  KEY_UP: 1 << 4,
  FOCUS: 1 << 5,
  EDITING: 1 << 6,
  SUBMIT: 1 << 7,
  SCROLL: 1 << 8,
  WHEEL: 1 << 9,
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

/** `FontWeight` wire values — numeric on the 100–900 scale (spec). */
export const FONT_WEIGHT = {
  LIGHT: 300,
  REGULAR: 400,
  MEDIUM: 500,
  SEMIBOLD: 600,
  BOLD: 700,
} as const;

/** `TOGGLE_STYLE` wire values (protocol ENUM). */
export const TOGGLE_STYLE = {
  SWITCH: 0,
  CHECKBOX: 1,
  BUTTON: 2,
} as const;

/** `SHAPE_KIND` wire values (protocol ENUM). */
export const SHAPE_KIND = {
  CIRCLE: 0,
  RECTANGLE: 1,
  ROUNDED_RECTANGLE: 2,
  CAPSULE: 3,
  ELLIPSE: 4,
  PATH: 5,
} as const;