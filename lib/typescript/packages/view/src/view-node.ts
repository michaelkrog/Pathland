/**
 * @pathland/view - ViewNode
 * 
 * Immutable node in the virtual UI tree with stable identity.
 * Each ViewNode has a unique nodeId that never changes for its lifetime.
 */

import type { PropertyValue } from '@pathland/protocol';
import { Signal, commandQueue } from './signal';
import { propertyNameToId, compilePropertyValue } from './utils';
import { getConditionalParent } from './renderer';
import { TapGesture, LongPressGesture } from './gestures';
import type { Gesture } from './gestures';

// Local component type constants (avoid protocol import to prevent circular dependency)
const COMPONENT_TYPES = {
  VSTACK: 0x0002,
  HSTACK: 0x0001,
  TEXT: 0x0003,
  BUTTON: 0x0004,
  SPACER: 0x0008,
  IMAGE: 0x0005,
  SCROLLVIEW: 0x0009,
  LIST: 0x000A,
  GRID: 0x000B,
  SWITCH: 0x0006,
  TEXT_FIELD: 0x0007,
} as const;


// ============================================
// TYPES
// ============================================

/**
 * A modifier that can be applied to a ViewNode.
 * Modifiers represent styling or behavior changes.
 */
interface Modifier {
  kind: string;
  [key: string]: any;
}

/**
 * A discrete gesture registration (kind + handler), mapped to a single event
 * type (e.g. tap -> CLICK). Lifecycle gestures use the `Gesture` class instead.
 */
export interface GestureSpec {
  kind: string;
  handler: () => void;
  [key: string]: any;
}

// ============================================
// NODE ID COUNTER
// ============================================

/**
 * Global counter for assigning unique node IDs.
 */
let nodeIdCounter = 0;

/**
 * Reset node ID counter (useful for testing).
 */
export function resetNodeIdCounter(): void {
  nodeIdCounter = 0;
}

// ============================================
// VIEW NODE CLASS
// ============================================

/**
 * A node in the virtual UI tree.
 */
export class ViewNode {
  type: string;
  children: ViewNode[];
  modifiers: Modifier[];
  gestures: GestureSpec[];
  attachedGestures: Gesture[];
  properties: Record<string, any>;
  nodeId: number;

  constructor(
    type: string,
    children: ViewNode[] = [],
    properties: Record<string, any> = {},
    modifiers: Modifier[] = [],
    gestures: GestureSpec[] = [],
    attachedGestures: Gesture[] = []
  ) {
    this.type = type;
    this.children = children;
    this.properties = { ...properties };
    this.modifiers = [...modifiers];
    this.gestures = [...gestures];
    this.attachedGestures = [...attachedGestures];
    this.nodeId = ++nodeIdCounter;
  }

  bindSignal(signal: Signal<any>, propertyName: string, compile?: (value: any) => PropertyValue): this {
    const propertyId = propertyNameToId(propertyName);
    if (propertyId === undefined) {
      console.warn(`Unknown property: ${propertyName}`);
      return this;
    }

    this.properties[propertyName] = signal.get();
    
    signal.bind(
      this.nodeId,
      propertyId,
      compile ?? ((v: any) => compilePropertyValue(propertyId, v))
    );

    return this;
  }

  withChildren(...additionalChildren: ViewNode[]): ViewNode {
    const newNode = new ViewNode(
      this.type,
      [...this.children, ...additionalChildren],
      { ...this.properties },
      [...this.modifiers],
      [...this.gestures],
      [...this.attachedGestures]
    );
    newNode.nodeId = this.nodeId;
    return newNode;
  }

  withModifier(modifier: Modifier): ViewNode {
    const newNode = new ViewNode(
      this.type,
      [...this.children],
      { ...this.properties },
      [...this.modifiers, modifier],
      [...this.gestures],
      [...this.attachedGestures]
    );
    newNode.nodeId = this.nodeId;
    return newNode;
  }

  withGesture(gesture: GestureSpec): ViewNode {
    const newNode = new ViewNode(
      this.type,
      [...this.children],
      { ...this.properties },
      [...this.modifiers],
      [...this.gestures, gesture],
      [...this.attachedGestures]
    );
    newNode.nodeId = this.nodeId;
    return newNode;
  }

  withAttachedGesture(gesture: Gesture): ViewNode {
    const newNode = new ViewNode(
      this.type,
      [...this.children],
      { ...this.properties },
      [...this.modifiers],
      [...this.gestures],
      [...this.attachedGestures, gesture]
    );
    newNode.nodeId = this.nodeId;
    return newNode;
  }

  withProperty(key: string, value: any): ViewNode {
    const newNode = new ViewNode(
      this.type,
      [...this.children],
      { ...this.properties, [key]: value },
      [...this.modifiers],
      [...this.gestures],
      [...this.attachedGestures]
    );
    newNode.nodeId = this.nodeId;
    return newNode;
  }

  // Chainable modifier methods
  padding(value: number): ViewNode;
  padding(top: number, right: number, bottom: number, left: number): ViewNode;
  padding(a: number, b?: number, c?: number, d?: number): ViewNode {
    if (b !== undefined && c !== undefined && d !== undefined) {
      // Per-edge padding (EdgeInsets).
      return this.withModifier({ kind: 'paddingInsets', top: a, right: b, bottom: c, left: d });
    }
    return this.withModifier({ kind: 'padding', value: a });
  }

  background(color: string | number): ViewNode {
    return this.withModifier({ kind: 'background', color });
  }

  color(color: string | number): ViewNode {
    return this.withModifier({ kind: 'color', color });
  }

  fontSize(value: number): ViewNode {
    return this.withModifier({ kind: 'fontSize', value });
  }

  fontWeight(value: number): ViewNode {
    return this.withModifier({ kind: 'fontWeight', value });
  }

  margin(value: number): ViewNode {
    return this.withModifier({ kind: 'margin', value });
  }

  gap(value: number): ViewNode {
    return this.withModifier({ kind: 'gap', value });
  }

  spacing(value: number): ViewNode {
    return this.withModifier({ kind: 'gap', value });
  }

  opacity(value: number): ViewNode {
    return this.withModifier({ kind: 'opacity', value });
  }

  visible(value: boolean): ViewNode {
    return this.withProperty('visible', value);
  }

  visibleSignal(signal: Signal<boolean>): ViewNode {
    return this.bindSignal(signal, 'visible', (v: boolean) => ({ type: 'u8', value: v ? 1 : 0 }));
  }

  // Chainable gesture methods
  tapGesture(handler: () => void): ViewNode {
    return this.withGesture({ kind: 'tap', handler });
  }

  longPressGesture(handler: () => void): ViewNode {
    return this.withGesture({ kind: 'longPress', handler });
  }

  hoverGesture(handler: () => void): ViewNode {
    return this.withGesture({ kind: 'hover', handler });
  }

  focusGesture(handler: () => void): ViewNode {
    return this.withGesture({ kind: 'focus', handler });
  }

  blurGesture(handler: () => void): ViewNode {
    return this.withGesture({ kind: 'blur', handler });
  }

  // Lifecycle gestures (SwiftUI-style). Attach a Gesture builder:
  //   .gesture(DragGesture().onChanged(v => ...).onEnded(v => ...))
  gesture(gesture: Gesture): ViewNode {
    return this.withAttachedGesture(gesture);
  }

  onTapGesture(handler: () => void): ViewNode {
    return this.gesture(TapGesture().onEnded(handler));
  }

  onLongPressGesture(handler: () => void): ViewNode {
    return this.gesture(LongPressGesture().onEnded(handler));
  }

  // Border modifiers
  border(width: number, color?: string | number): ViewNode {
    return this.withModifier({ kind: 'border', width, color });
  }

  borderWidth(width: number): ViewNode {
    return this.withModifier({ kind: 'borderWidth', width });
  }

  borderColor(color: string | number): ViewNode {
    return this.withModifier({ kind: 'borderColor', color });
  }

  // Corner radius modifier
  cornerRadius(value: number): ViewNode {
    return this.withModifier({ kind: 'cornerRadius', value });
  }

  // ============================================
  // CONDITIONAL RENDERING
  // ============================================

  /**
   * Create a ViewNode that conditionally renders its content based on a signal.
   * When the signal is true, the content is shown. When false, the content is removed from the tree.
   * 
   * This method creates a placeholder node that is skipped during compilation (no CREATE_NODE sent).
   * The content is inserted directly into the placeholder's parent at the placeholder's index position.
   * 
   * @param condition The boolean signal that controls whether content is shown
   * @param createContent Function that creates the content ViewNode
   * @returns A ViewNode that serves as a placeholder (type 'if') - not rendered to DOM
   */
  static if(condition: Signal<boolean>, createContent: () => ViewNode): ViewNode {
    // Track the created content node
    let contentNode: ViewNode | null = null;
    const placeholder = new ViewNode('if', []);
    
    // Store contentNode reference on the placeholder for access during compileNode
    (placeholder as any)._contentNode = null;

    // For initial render, create content if condition is true
    if (condition.get()) {
      contentNode = createContent();
      // Store on placeholder for compileNode to access
      (placeholder as any)._contentNode = contentNode;
    }

    // Function to get component type from node type
    function getComponentType(nodeType: string): number {
      const types: Record<string, number> = {
        'VStack': COMPONENT_TYPES.VSTACK,
        'HStack': COMPONENT_TYPES.HSTACK,
        'Text': COMPONENT_TYPES.TEXT,
        'Button': COMPONENT_TYPES.BUTTON,
        'Spacer': COMPONENT_TYPES.SPACER,
        'Image': COMPONENT_TYPES.IMAGE,
        'ScrollView': COMPONENT_TYPES.SCROLLVIEW,
        'List': COMPONENT_TYPES.LIST,
        'Grid': COMPONENT_TYPES.GRID,
        'Switch': COMPONENT_TYPES.SWITCH,
        'TextField': COMPONENT_TYPES.TEXT_FIELD,
      };
      return types[nodeType] ?? 0;
    }

    // Function to recursively send CREATE_NODE commands for a node and its children
    function sendCreateNodeRecursive(node: ViewNode, parentId: number, index: number): void {
      const componentType = getComponentType(node.type);
      
      // Send CREATE_NODE command
      commandQueue.add({
        opcode: 'CREATE_NODE',
        nodeId: node.nodeId,
        componentType: componentType,
        properties: new Map<number, any>()
      });
      
      // Apply properties
      for (const [key, val] of Object.entries(node.properties)) {
        const propId = propertyNameToId(key);
        if (propId !== undefined) {
          commandQueue.add({
            opcode: 'SET_PROPERTY',
            nodeId: node.nodeId,
            propertyId: propId,
            value: compilePropertyValue(propId, val)
          });
        }
      }
      
      // Send INSERT_CHILD command to add to parent
      commandQueue.add({
        opcode: 'INSERT_CHILD',
        parentId: parentId,
        childId: node.nodeId,
        index: index
      });
      
      // Recursively create children
      for (let i = 0; i < node.children.length; i++) {
        sendCreateNodeRecursive(node.children[i], node.nodeId, i);
      }
    }

    // Function to recursively send DELETE_NODE commands for a node and its children
    function sendDeleteNodeRecursive(node: ViewNode): void {
      // Delete children first (bottom-up)
      for (const child of node.children) {
        sendDeleteNodeRecursive(child);
      }
      
      // Then delete this node
      commandQueue.add({
        opcode: 'DELETE_NODE',
        nodeId: node.nodeId
      });
    }

    // Subscribe to condition changes
    condition.subscribe((visible: boolean) => {
      // Get parent context from registry (populated during compileNode)
      const parentContext = getConditionalParent(placeholder.nodeId);
      
      if (visible && !contentNode) {
        // Create the content node
        contentNode = createContent();
        placeholder.children = [contentNode];
        
        // Send commands to create and insert the content into the parent
        if (parentContext) {
          sendCreateNodeRecursive(contentNode, parentContext.parentId, parentContext.index);
        }
        
      } else if (!visible && contentNode) {
        // Delete the content node and all its children
        sendDeleteNodeRecursive(contentNode);
        contentNode = null;
        placeholder.children = [];
      }
    });

    return placeholder;
  }
}

export type { Modifier, Gesture };
