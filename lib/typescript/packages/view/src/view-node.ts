/**
 * @pathland/view - ViewNode
 * 
 * Immutable node in the virtual UI tree with stable identity.
 * Each ViewNode has a unique nodeId that never changes for its lifetime.
 */

import type { PropertyValue } from '@pathland/protocol';
import { Signal, commandQueue } from './signal';
import { propertyNameToId, compilePropertyValue } from './utils';


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
 * A gesture that can be attached to a ViewNode.
 * Gestures represent interaction handlers.
 */
interface Gesture {
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
  gestures: Gesture[];
  properties: Record<string, any>;
  nodeId: number;

  constructor(
    type: string,
    children: ViewNode[] = [],
    properties: Record<string, any> = {},
    modifiers: Modifier[] = [],
    gestures: Gesture[] = []
  ) {
    this.type = type;
    this.children = children;
    this.properties = { ...properties };
    this.modifiers = [...modifiers];
    this.gestures = [...gestures];
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
      [...this.gestures]
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
      [...this.gestures]
    );
    newNode.nodeId = this.nodeId;
    return newNode;
  }

  withGesture(gesture: Gesture): ViewNode {
    const newNode = new ViewNode(
      this.type,
      [...this.children],
      { ...this.properties },
      [...this.modifiers],
      [...this.gestures, gesture]
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
      [...this.gestures]
    );
    newNode.nodeId = this.nodeId;
    return newNode;
  }

  // Chainable modifier methods
  padding(value: number): ViewNode {
    return this.withModifier({ kind: 'padding', value });
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
   * This method creates a special conditional node that manages the lifecycle of its content.
   * The content is created lazily when the signal becomes true, and deleted when false.
   * 
   * @param condition The boolean signal that controls whether content is shown
   * @param createContent Function that creates the content ViewNode
   * @returns A ViewNode that represents the conditional content
   */
  static if(condition: Signal<boolean>, createContent: () => ViewNode): ViewNode {
    // Track the created content node
    let contentNode: ViewNode | null = null;
    const placeholder = new ViewNode('if', []);

    // For initial render, create content if condition is true
    if (condition.get()) {
      contentNode = createContent();
      placeholder.children = [contentNode];
    }

    // Subscribe to condition changes using the Signal's binding mechanism
    condition.bind(placeholder.nodeId, 0, (visible: boolean) => {
      if (visible && !contentNode) {
        // Create the content node
        contentNode = createContent();
        
        // Map node type to component type
        let componentType = 0;
        if (contentNode.type === 'VStack') componentType = 0x0002;
        else if (contentNode.type === 'HStack') componentType = 0x0001;
        else if (contentNode.type === 'Text') componentType = 0x0003;
        else if (contentNode.type === 'Button') componentType = 0x0004;
        else if (contentNode.type === 'Spacer') componentType = 0x0008;
        
        // Send CREATE_NODE command
        commandQueue.add({
          opcode: 'CREATE_NODE',
          nodeId: contentNode.nodeId,
          componentType: componentType,
          properties: new Map<number, any>()
        });
        
        // Send INSERT_CHILD command
        commandQueue.add({
          opcode: 'INSERT_CHILD',
          parentId: placeholder.nodeId,
          childId: contentNode.nodeId,
          index: 0
        });
        
        // Apply properties
        for (const [key, val] of Object.entries(contentNode.properties)) {
          const propId = propertyNameToId(key);
          if (propId !== undefined) {
            commandQueue.add({
              opcode: 'SET_PROPERTY',
              nodeId: contentNode.nodeId,
              propertyId: propId,
              value: compilePropertyValue(propId, val)
            });
          }
        }
        
      } else if (!visible && contentNode) {
        // Delete the content node
        commandQueue.add({
          opcode: 'DELETE_NODE',
          nodeId: contentNode.nodeId
        });
        contentNode = null;
      }
      
      return { type: 'u8', value: 0 }; // Dummy return for binding
    });

    return placeholder;
  }
}

export type { Modifier, Gesture };
