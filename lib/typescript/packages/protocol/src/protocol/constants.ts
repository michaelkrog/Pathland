/**
 * Pathland Protocol Constants
 * 
 * All constants are derived from spec/BINARY_PROTOCOL.md
 */

// Protocol

export const PROTOCOL_VERSION = 1;
export const LITTLE_ENDIAN = true;
export const ROOT_CONTAINER_ID = 0;
export const HEADER_SIZE = 6;

// Opcodes
export const Opcode = {
  CREATE_NODE: 0x01,
  DELETE_NODE: 0x02,
  INSERT_CHILD: 0x03,
  REMOVE_CHILD: 0x04,
  SET_PROPERTY: 0x05,
  SET_DESIGN_TOKEN: 0x06,
  DISPATCH_EVENT: 0x07,
  REGISTER_EVENT_HANDLER: 0x08,
  GESTURE_UPDATE: 0x09,
  ATTACH_GESTURE: 0x0A,
  COMBINE_GESTURES: 0x0B,
  MOVE_CHILD: 0x0C,
  RESET: 0x0D,
  SET_ENVIRONMENT: 0x20,
  UPDATE_ENVIRONMENT: 0x21,
  REQUEST_ENVIRONMENT: 0x22,
} as const;

// Component Types
export const ComponentType = {
  HSTACK: 0x0001,
  VSTACK: 0x0002,
  TEXT: 0x0003,
  BUTTON: 0x0004,
  IMAGE: 0x0005,
  SWITCH: 0x0006,
  TEXT_FIELD: 0x0007,
  SPACER: 0x0008,
  SCROLLVIEW: 0x0009,
  LIST: 0x000A,
  GRID: 0x000B,
  COMMENT: 0x000C,
} as const;

// Property IDs - Stack
export const StackProperty = {
  SPACING: 0x0001,
  ALIGNMENT: 0x0002,
  JUSTIFICATION: 0x0003,
  PADDING: 0x0004,
  CONTENT_MARGINS: 0x0005,
} as const;

// Property IDs - Text
export const TextProperty = {
  TEXT: 0x000A,
  LINE_LIMIT: 0x000B,
  TEXT_ALIGNMENT: 0x000C,
  TRUNCATION_MODE: 0x000D,
  LINE_SPACING: 0x000E,
  BASELINE_OFFSET: 0x000F,
} as const;

// Property IDs - Style
export const StyleProperty = {
  BACKGROUND_COLOR: 0x1001,
  BACKGROUND_OPACITY: 0x1002,
  BORDER_WIDTH: 0x1003,
  BORDER_COLOR: 0x1004,
  BORDER_RADIUS: 0x1005,
  PADDING: 0x1006,
  FONT_SIZE: 0x1007,
  FONT_WEIGHT: 0x1008,
  FONT_FAMILY: 0x1009,
  COLOR: 0x100A,
  WIDTH: 0x100B,
  HEIGHT: 0x100C,
  OPACITY: 0x100D,
  VISIBLE: 0x100E,
  Z_INDEX: 0x100F,
  CLIP_TO_BOUNDS: 0x1010,
  PADDING_TOP: 0x1012,
  PADDING_RIGHT: 0x1013,
  PADDING_BOTTOM: 0x1014,
  PADDING_LEFT: 0x1015,
} as const;

// Property IDs - Semantic
export const SemanticProperty = {
  ROLE: 0x2001,
  STATE: 0x2002,
  ENABLED: 0x2003,
  SELECTED: 0x2004,
} as const;

// Value Types
export const ValueType = {
  U8: 0x01,
  U32: 0x02,
  I32: 0x03,
  F32: 0x04,
  STRING: 0x05,
  ENUM: 0x06,
  COLOR: 0x07,
  DESIGN_TOKEN: 0x08,
} as const;

// Color Kinds
export const ColorKind = {
  SEMANTIC_TOKEN: 0x01,
  LITERAL_SRGB: 0x02,
} as const;

// Semantic Color Tokens
export const SemanticColorToken = {
  PRIMARY_TEXT: 0x0001,
  SECONDARY_TEXT: 0x0002,
  TERTIARY_TEXT: 0x0003,
  BACKGROUND: 0x0004,
  SURFACE: 0x0005,
  ACCENT: 0x0006,
  ERROR: 0x0007,
  SUCCESS: 0x0008,
  WARNING: 0x0009,
  INFO: 0x000A,
  BORDER: 0x000B,
  SEPARATOR: 0x000C,
} as const;

// Special Values
export const FILL = -1.0;
export const HUG_CONTENT = -2.0;

// Environment Field IDs
export const EnvironmentField = {
  VIEWPORT_WIDTH_PX: 0x01,
  VIEWPORT_HEIGHT_PX: 0x02,
  VIEWPORT_WIDTH_DP: 0x03,
  VIEWPORT_HEIGHT_DP: 0x04,
  DEVICE_PIXEL_RATIO: 0x05,
  SAFE_AREA_TOP: 0x06,
  SAFE_AREA_RIGHT: 0x07,
  SAFE_AREA_BOTTOM: 0x08,
  SAFE_AREA_LEFT: 0x09,
  COLOR_SCHEME: 0x0A,
  TEXT_DIRECTION: 0x0B,
  REDUCED_MOTION: 0x0C,
  FONT_SCALE: 0x0D,
  PLATFORM: 0x0E,
  DEVICE_TYPE: 0x0F,
  POINTER_TYPE: 0x10,
  KEYBOARD_AVAILABLE: 0x11,
  ORIENTATION: 0x12,
  LOCALE: 0x13,
  TIMEZONE: 0x14,
} as const;

// Enums
// Event Types
export const EventType = {
  TAP: 0x01,
  DOUBLE_TAP: 0x02,
  LONG_PRESS: 0x03,
  CLICK: 0x04,
  HOVER: 0x05,
  FOCUS: 0x06,
  BLUR: 0x07,
  KEY_DOWN: 0x08,
  KEY_UP: 0x09,
  SCROLL: 0x0A,
  SWIPE: 0x0B,
  ON_APPEAR: 0x0C,
  ON_DISAPPEAR: 0x0D,
  ON_CHANGE: 0x0E,
} as const;

// Gesture Types
export const GestureType = {
  TAP: 0x10,
  LONG_PRESS: 0x11,
  DRAG: 0x12,
  SWIPE: 0x13,
  PINCH: 0x14,
  ROTATE: 0x15,
} as const;

// Gesture States
export const GestureState = {
  BEGAN: 0x00,
  CHANGED: 0x01,
  ENDED: 0x02,
  CANCELLED: 0x03,
} as const;

// Event Phases
export const EventPhase = {
  CAPTURE: 0x00,
  TARGET: 0x01,
  BUBBLE: 0x02,
  ANY: 0xFF,
} as const;

export const Alignment = {
  START: 0x00,
  CENTER: 0x01,
  END: 0x02,
  STRETCH: 0x03,
} as const;

export const Justification = {
  START: 0x00,
  CENTER: 0x01,
  END: 0x02,
  SPACE_BETWEEN: 0x03,
  SPACE_AROUND: 0x04,
  SPACE_EVENLY: 0x05,
} as const;

export const TextAlignment = {
  LEADING: 0x00,
  CENTER: 0x01,
  TRAILING: 0x02,
} as const;

export const ColorScheme = {
  LIGHT: 0,
  DARK: 1,
  SYSTEM: 2,
} as const;

export const Platform = {
  IOS: 0,
  ANDROID: 1,
  WEB: 2,
  WINDOWS: 3,
  MACOS: 4,
  LINUX: 5,
  UNKNOWN: 255,
} as const;

export const DeviceType = {
  PHONE: 0,
  TABLET: 1,
  DESKTOP: 2,
  EMBEDDED: 3,
  UNKNOWN: 255,
} as const;

export const PointerType = {
  TOUCH: 0,
  MOUSE: 1,
  PEN: 2,
  UNKNOWN: 255,
} as const;

export const Orientation = {
  PORTRAIT: 0,
  LANDSCAPE: 1,
  SQUARE: 2,
} as const;

// Utility
export function packRGBA(a: number, r: number, g: number, b: number): number {
  return ((a & 0xFF) << 24) | ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF);
}

export function unpackRGBA(packed: number): { a: number; r: number; g: number; b: number } {
  return {
    a: (packed >>> 24) & 0xFF,
    r: (packed >>> 16) & 0xFF,
    g: (packed >>> 8) & 0xFF,
    b: packed & 0xFF,
  };
}
