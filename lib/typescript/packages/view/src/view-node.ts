/**
 * @pathland/view - ViewNode
 * 
 * Immutable node in the virtual UI tree with stable identity.
 * Each ViewNode has a unique nodeId that never changes for its lifetime.
 */

import type { PropertyValue } from '@pathland/protocol';
import { Signal } from './signal';
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

  margin(value: number): ViewNode {
    return this.withModifier({ kind: 'margin', value });
  }

  gap(value: number): ViewNode {
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
}

export type { Modifier, Gesture };
