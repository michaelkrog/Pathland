/**
 * @pathland/view - ViewNode
 * 
 * Immutable node in the virtual UI tree with stable identity.
 * Each ViewNode has a unique nodeId that never changes for its lifetime.
 */

import type { PropertyValue } from '@pathland/protocol';
import { ComponentType } from '@pathland/protocol';
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
   * Uses a COMMENT component type for the placeholder, which renders as a DOM comment
   * and avoids adding extra visible DOM elements. The conditional content is inserted
   * as a sibling after the comment node.
   * 
   * @param condition The boolean signal that controls whether content is shown
   * @param createContent Function that creates the content ViewNode
   * @returns A ViewNode that represents the conditional placeholder (comment node)
   */
  static if(condition: Signal<boolean>, createContent: () => ViewNode): ViewNode {
    // Track the created content node
    let contentNode: ViewNode | null = null;
    
    // Create a COMMENT placeholder node - this will render as <!--pathland-conditional-->
    // and won't add any visible DOM element
    // We use a dummy type 'comment' that will be mapped to ComponentType.COMMENT
    const placeholder = new ViewNode('comment', []);

    // Map ViewNode type to Pathland ComponentType
    function getComponentType(node: ViewNode): number {
      switch (node.type) {
        case 'VStack': return ComponentType.VSTACK;
        case 'HStack': return ComponentType.HSTACK;
        case 'Text': return ComponentType.TEXT;
        case 'Button': return ComponentType.BUTTON;
        case 'Spacer': return ComponentType.SPACER;
        case 'Image': return ComponentType.IMAGE;
        case 'ScrollView': return ComponentType.SCROLLVIEW;
        case 'List': return ComponentType.LIST;
        case 'Grid': return ComponentType.GRID;
        case 'Switch': return ComponentType.SWITCH;
        case 'TextField': return ComponentType.TEXT_FIELD;
        case 'comment': return ComponentType.COMMENT;
        default: return 0; // Unknown component type
      }
    }

    // Function to recursively create and send commands for a node and its children
    function sendCreateNodeWithChildren(node: ViewNode, parentId: number, index: number): void {
      // Send CREATE_NODE for this node
      const componentType = getComponentType(node);
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
      
      // Send INSERT_CHILD to add this node to parent
      commandQueue.add({
        opcode: 'INSERT_CHILD',
        parentId: parentId,
        childId: node.nodeId,
        index: index
      });
      
      // Recursively create children
      for (let i = 0; i < node.children.length; i++) {
        sendCreateNodeWithChildren(node.children[i], node.nodeId, i);
      }
    }

    // Function to send delete command for a node and its children
    function sendDeleteNode(node: ViewNode): void {
      // Recursively delete children first
      for (const child of node.children) {
        sendDeleteNode(child);
      }
      
      // Then delete this node
      commandQueue.add({
        opcode: 'DELETE_NODE',
        nodeId: node.nodeId
      });
    }

    // For initial render, create placeholder and content if condition is true
    // Send CREATE_NODE for placeholder (comment node)
    commandQueue.add({
      opcode: 'CREATE_NODE',
      nodeId: placeholder.nodeId,
      componentType: ComponentType.COMMENT,
      properties: new Map<number, any>()
    });

    if (condition.get()) {
      contentNode = createContent();
      placeholder.children = [contentNode];
      
      // Send commands to create the content node as child of placeholder
      // The renderer will handle COMMENT nodes specially by inserting as siblings
      sendCreateNodeWithChildren(contentNode, placeholder.nodeId, 0);
    }

    // Subscribe to condition changes
    condition.subscribe((visible: boolean) => {
      if (visible && !contentNode) {
        // Create the content node
        contentNode = createContent();
        placeholder.children = [contentNode];
        
        // Send commands to create and insert the content
        sendCreateNodeWithChildren(contentNode, placeholder.nodeId, 0);
        
      } else if (!visible && contentNode) {
        // Delete the content node and all its children
        sendDeleteNode(contentNode);
        contentNode = null;
        placeholder.children = [];
      }
    });

    return placeholder;
  }
}

export type { Modifier, Gesture };
