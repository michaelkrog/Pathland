import { 
  ComponentType, 
  Alignment,
  Justification,
  TextAlignment
} from '../protocol/constants';

// ============================================
// VALUE TYPES
// ============================================

export type PropertyValue =
  | { type: 'u8'; value: number }
  | { type: 'u32'; value: number }
  | { type: 'i32'; value: number }
  | { type: 'f32'; value: number }
  | { type: 'string'; value: string }
  | { type: 'enum'; value: number }
  | { type: 'color'; kind: 'semantic'; tokenId: number }
  | { type: 'color'; kind: 'literal'; rgba: number }
  | { type: 'designToken'; path: string };

// ============================================
// COMPONENT TREE TYPES
// ============================================

export interface BaseComponent {
  id: number;
  type: ComponentType;
  children: number[];
  // Style properties (applicable to all components)
  width?: number;
  height?: number;
  opacity?: number;
  visible?: boolean;
  zIndex?: number;
  clipsToBounds?: boolean;
  backgroundColor?: number | string; // Color value or design token path
  padding?: number | string; // F32 or design token path
  borderWidth?: number | string;
  borderColor?: number | string;
  borderRadius?: number | string;
}

export interface HStackComponent extends BaseComponent {
  type: ComponentType.HSTACK;
  // Component-specific properties
  spacing?: number;
  alignment?: Alignment;
  justification?: Justification;
  contentMargins?: number;
  // Stack-specific padding (0x0004)
  stackPadding?: number;
}

export interface VStackComponent extends BaseComponent {
  type: ComponentType.VSTACK;
  // Component-specific properties
  spacing?: number;
  alignment?: Alignment;
  justification?: Justification;
  contentMargins?: number;
  // Stack-specific padding (0x0004)
  stackPadding?: number;
}

export interface TextComponent extends BaseComponent {
  type: ComponentType.TEXT;
  // Component-specific properties
  text: string;
  textAlignment?: TextAlignment;
  lineLimit?: number;
  truncationMode?: number;
  lineSpacing?: number;
  baselineOffset?: number;
  // Style properties (text-specific)
  color?: number | string; // Text color (color value or design token path)
  fontSize?: number | string;
  fontWeight?: number | string;
  fontFamily?: string;
}

export interface SpacerComponent extends BaseComponent {
  type: ComponentType.SPACER;
}

export interface ButtonComponent extends BaseComponent {
  type: ComponentType.BUTTON;
  // Button-specific properties
  role?: number; // Semantic role
  enabled?: boolean;
  selected?: boolean;
}

export type Component = 
  | HStackComponent 
  | VStackComponent 
  | TextComponent 
  | SpacerComponent
  | ButtonComponent;

// ============================================
// UI TREE
// ============================================

export interface UITree {
  version: number;
  components: Map<number, Component>;
  rootIds: number[];
}

// ============================================
// COMMAND TYPES
// ============================================

export type Command =
  | { opcode: 'CREATE_NODE'; nodeId: number; componentType: ComponentType; properties: Map<number, PropertyValue> }
  | { opcode: 'DELETE_NODE'; nodeId: number }
  | { opcode: 'INSERT_CHILD'; parentId: number; childId: number; index: number }
  | { opcode: 'REMOVE_CHILD'; parentId: number; childId: number }
  | { opcode: 'SET_PROPERTY'; nodeId: number; propertyId: number; value: PropertyValue }
  | { opcode: 'SET_DESIGN_TOKEN'; tokenPath: string; value: PropertyValue };

// ============================================
// RENDERER TYPES
// ============================================

export interface RenderElement {
  element: HTMLElement;
  componentId: number;
  children: HTMLElement[];
}

// Event handler type
export type EventHandler = (event: { type: string; targetId: number; data: any }) => void;

// ============================================
// UTILITY TYPES
// ============================================

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
