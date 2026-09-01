// Protocol constants. Mirror spec/OPCODE.md (header/commands/properties),
// spec/PRIMITIVES.md (components), and spec/EVENTS.md (events).

// Batch header
export const MAGIC = 0x504c504c; // "PLPL"
export const VERSION = 1;
export const HEADER_SIZE = 16;
export const OPCODE_SIZE = 16;
export const FLAG_HOST_TO_GUEST = 0x0001;

// Categories
export const CAT_TREE = 0x01;
export const CAT_STYLE = 0x02;
export const CAT_EVENT = 0x03;

// TREE commands
export const CMD_CREATE_NODE = 0x01;
export const CMD_DELETE_NODE = 0x02;
export const CMD_INSERT_CHILD = 0x03;
export const CMD_REMOVE_CHILD = 0x04;
export const CMD_MOVE_CHILD = 0x05;

// STYLE commands
export const CMD_SET_PROPERTY = 0x01;
export const CMD_SET_DESIGN_TOKEN = 0x02;
export const CMD_SET_TEXT = 0x03;
export const CMD_SET_DATE = 0x04;

// EVENT commands (host -> guest)
export const CMD_POINTER_UP = 0x03;
export const CMD_VALUE_CHANGED = 0x06;
export const CMD_TEXT_CHANGED = 0x07;
export const CMD_DATE_CHANGED = 0x0d;

// Value types (spec/OPCODE.md)
export const VAL_STRING = 0x05;

// Property IDs (spec/MODIFIERS.md)
export const PROP_SPACING = 0x0001;
export const PROP_ALIGNMENT = 0x0002;
export const PROP_CONTENT_MARGINS = 0x0005;
export const PROP_BACKGROUND_COLOR = 0x1001;
export const PROP_BORDER_WIDTH = 0x1003;
export const PROP_BORDER_COLOR = 0x1004;
export const PROP_BORDER_RADIUS = 0x1005;
export const PROP_COLOR = 0x100a;
export const PROP_WIDTH = 0x100b;
export const PROP_HEIGHT = 0x100c;
export const PROP_OPACITY = 0x100d;
export const PROP_VISIBLE = 0x100e;
export const PROP_PADDING = 0x1011;
export const PROP_PADDING_TOP = 0x1012;
export const PROP_PADDING_RIGHT = 0x1013;
export const PROP_PADDING_BOTTOM = 0x1014;
export const PROP_PADDING_LEFT = 0x1015;
export const PROP_ROLE = 0x2001;
export const PROP_STATE = 0x2002;
export const PROP_ENABLED = 0x2003;
export const PROP_SELECTED = 0x2004;
export const PROP_VALUE = 0x2006;
export const PROP_LABEL = 0x200a;
export const PROP_PROMPT = 0x200b;
export const PROP_SELECTION = 0x2010;
export const PROP_COLOR_VALUE = 0x2012;

// Width/height hints (WIDTH/HEIGHT values)
export const WIDTH_FILL = -1;
export const WIDTH_HUG = -2;

// Alignment enum (protocol ENUM values)
export const ALIGN_LEADING = 0;
export const ALIGN_CENTER = 1;
export const ALIGN_TRAILING = 2;
export const ALIGN_FILL = 3;

// Components (spec/PRIMITIVES.md)
export const COMPONENT_TEXT = 0x01;
export const COMPONENT_IMAGE = 0x02;
export const COMPONENT_COLOR = 0x03;
export const COMPONENT_SHAPE = 0x04;
export const COMPONENT_DIVIDER = 0x05;
export const COMPONENT_SPACER = 0x06;
export const COMPONENT_PROGRESS_VIEW = 0x07;
export const COMPONENT_GAUGE = 0x08;
export const COMPONENT_VSTACK = 0x10;
export const COMPONENT_HSTACK = 0x11;
export const COMPONENT_ZSTACK = 0x12;
export const COMPONENT_GRID = 0x13;
export const COMPONENT_SCROLLVIEW = 0x14;
export const COMPONENT_LAZY_VGRID = 0x15;
export const COMPONENT_LAZY_HGRID = 0x16;
export const COMPONENT_LAZY_VSTACK = 0x1b;
export const COMPONENT_LAZY_HSTACK = 0x1c;
export const COMPONENT_BUTTON = 0x20;
export const COMPONENT_TEXT_FIELD = 0x21;
export const COMPONENT_TEXT_EDITOR = 0x22;
export const COMPONENT_TOGGLE = 0x24;
export const COMPONENT_SLIDER = 0x25;
export const COMPONENT_STEPPER = 0x26;
export const COMPONENT_DATE_PICKER = 0x27;
export const COMPONENT_PICKER = 0x28;
export const COMPONENT_MENU = 0x29;
export const COMPONENT_COLOR_PICKER = 0x2a;
export const COMPONENT_COMMENT = 0x7f;