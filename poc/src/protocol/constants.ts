// ============================================
// BINARY PROTOCOL CONSTANTS
// Source: spec/BINARY_PROTOCOL.md
// ============================================

// ===== Endianness =====
export const LITTLE_ENDIAN = true;

// ===== Special Node IDs =====
// 0 is reserved for the root container (not a real node, just a target for INSERT_CHILD)
export const ROOT_CONTAINER_ID = 0;

// ===== Message Header =====
export const HEADER_SIZE = 6; // u16 version + u32 instructionCount

// ===== Opcodes =====
export enum Opcode {
  CREATE_NODE = 0x01,
  DELETE_NODE = 0x02,
  INSERT_CHILD = 0x03,
  REMOVE_CHILD = 0x04,
  SET_PROPERTY = 0x05,
  SET_DESIGN_TOKEN = 0x06,
  DISPATCH_EVENT = 0x07,
  REGISTER_EVENT_HANDLER = 0x08,
  GESTURE_UPDATE = 0x09,
  ATTACH_GESTURE = 0x0A,
  COMBINE_GESTURES = 0x0B,
}

// ===== Component Types =====
export enum ComponentType {
  HSTACK = 0x0001,
  VSTACK = 0x0002,
  TEXT = 0x0003,
  BUTTON = 0x0004,
  IMAGE = 0x0005,
  SWITCH = 0x0006,
  TEXT_FIELD = 0x0007,
  SPACER = 0x0008,
}

// ===== Property IDs =====
// HSTACK/VSTACK properties (0x0001-0x0005)
export enum StackProperty {
  SPACING = 0x0001,
  ALIGNMENT = 0x0002,
  JUSTIFICATION = 0x0003,
  PADDING = 0x0004,
  CONTENT_MARGINS = 0x0005,
}

// TEXT properties (0x000A-0x000F)
export enum TextProperty {
  TEXT = 0x000A,
  LINE_LIMIT = 0x000B,
  TEXT_ALIGNMENT = 0x000C,
  TRUNCATION_MODE = 0x000D,
  LINE_SPACING = 0x000E,
  BASELINE_OFFSET = 0x000F,
}

// Style properties (0x1000-0x10FF)
export enum StyleProperty {
  BACKGROUND_COLOR = 0x1001,
  BACKGROUND_OPACITY = 0x1002,
  BORDER_WIDTH = 0x1003,
  BORDER_COLOR = 0x1004,
  BORDER_RADIUS = 0x1005,
  PADDING = 0x1006,
  FONT_SIZE = 0x1007,
  FONT_WEIGHT = 0x1008,
  FONT_FAMILY = 0x1009,
  COLOR = 0x100A,
  WIDTH = 0x100B,
  HEIGHT = 0x100C,
  OPACITY = 0x100D,
  VISIBLE = 0x100E,
  Z_INDEX = 0x100F,
  CLIPSTO_BOUNDS = 0x1010,
}

// ===== Semantic Properties (0x2000-0x2FFF) =====
export enum SemanticProperty {
  ROLE = 0x2001,
  STATE = 0x2002,
  ENABLED = 0x2003,
  SELECTED = 0x2004,
}

// ===== Value Types =====
export enum ValueType {
  U8 = 0x01,
  U32 = 0x02,
  I32 = 0x03,
  F32 = 0x04,
  STRING = 0x05,
  ENUM = 0x06,
  COLOR = 0x07,
  DESIGN_TOKEN = 0x08,
}

// ===== Alignment Enum =====
export enum Alignment {
  START = 0x00,
  CENTER = 0x01,
  END = 0x02,
  STRETCH = 0x03,
}

// ===== Justification Enum =====
export enum Justification {
  START = 0x00,
  CENTER = 0x01,
  END = 0x02,
  SPACE_BETWEEN = 0x03,
  SPACE_AROUND = 0x04,
  SPACE_EVENLY = 0x05,
}

// ===== TextAlignment Enum =====
export enum TextAlignment {
  LEADING = 0x00,
  CENTER = 0x01,
  TRAILING = 0x02,
}

// ===== Special Width/Height Values =====
export const FILL = -1.0;      // Fill available space
export const HUG_CONTENT = -2.0; // Size to fit content

// ===== Event Types =====
export enum EventType {
  TAP = 0x01,
  DOUBLE_TAP = 0x02,
  LONG_PRESS = 0x03,
  CLICK = 0x04,
  HOVER = 0x05,
  FOCUS = 0x06,
  BLUR = 0x07,
  KEY_DOWN = 0x08,
  KEY_UP = 0x09,
  SCROLL = 0x0A,
  SWIPE = 0x0B,
  ON_APPEAR = 0x0C,
  ON_DISAPPEAR = 0x0D,
  ON_CHANGE = 0x0E,
}

// ===== Event Phase =====
export enum EventPhase {
  CAPTURE = 0x00,
  TARGET = 0x01,
  BUBBLE = 0x02,
}

// ===== Color Constants =====
export enum SemanticColorToken {
  PRIMARY_TEXT = 0x0001,
  SECONDARY_TEXT = 0x0002,
  TERTIARY_TEXT = 0x0003,
  BACKGROUND = 0x0004,
  SURFACE = 0x0005,
  ACCENT = 0x0006,
  ERROR = 0x0007,
  SUCCESS = 0x0008,
  WARNING = 0x0009,
  INFO = 0x000A,
  BORDER = 0x000B,
  SEPARATOR = 0x000C,
}

// Helper to pack RGBA to u32 (0xAARRGGBB)
export function packRGBA(a: number, r: number, g: number, b: number): number {
  return ((a & 0xFF) << 24) | ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF);
}

// Helper to unpack RGBA from u32
export function unpackRGBA(packed: number): { a: number, r: number, g: number, b: number } {
  return {
    a: (packed >>> 24) & 0xFF,
    r: (packed >>> 16) & 0xFF,
    g: (packed >>> 8) & 0xFF,
    b: packed & 0xFF,
  };
}
