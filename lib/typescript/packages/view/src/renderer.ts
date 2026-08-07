/**
 * @pathland/view - Renderer
 * 
 * Compiles ViewNode trees to Pathland binary commands.
 * Handles initial render only - updates are handled directly by signals.
 */

import { ViewNode, Modifier, Gesture } from './view-node';
import type { PropertyValue } from '@pathland/protocol';
import { ComponentType, StackProperty, StyleProperty, EventType } from '@pathland/protocol';
import { commandQueue, Signal } from './signal';
import { propertyNameToId, compilePropertyValue } from './utils';

// Re-export types
export type { PropertyValue };

// ============================================
// TYPE MAPPING
// ============================================

function mapType(type: string): number {
  const mapping: Record<string, number> = {
    'VStack': ComponentType.VSTACK,
    'HStack': ComponentType.HSTACK,
    'Text': ComponentType.TEXT,
  };
  return mapping[type] ?? ComponentType.HSTACK;
}

function compileColor(color: string | number): PropertyValue {
  if (typeof color === 'number') {
    return { type: 'color', kind: 'literal', rgba: color };
  }

  const normalizedColor = color.toLowerCase();

  // Semantic color tokens, matching spec/BINARY_PROTOCOL.md semantic token table.
  const tokens: Record<string, number> = {
    'primary': 0x0001,
    'secondary': 0x0002,
    'text': 0x0001,
    'textsecondary': 0x0002,
    'background': 0x0004,
    'surface': 0x0005,
    'accent': 0x0006,
    'error': 0x0007,
    'warning': 0x0009,
    'success': 0x0008,
    'info': 0x000A,
  };

  if (tokens[normalizedColor] !== undefined) {
    return { type: 'color', kind: 'semantic', tokenId: tokens[normalizedColor] };
  }

  // Named literal colors (no semantic token exists for these).
  const literals: Record<string, number> = {
    'white': 0xFFFFFFFF,
    'black': 0xFF000000,
    'transparent': 0x00000000,
    'red': 0xFFFF0000,
    'green': 0xFF00FF00,
    'blue': 0xFF0000FF,
  };

  if (literals[normalizedColor] !== undefined) {
    return { type: 'color', kind: 'literal', rgba: literals[normalizedColor] };
  }

  return { type: 'color', kind: 'semantic', tokenId: 0x0004 };
}

function mapGestureKind(kind: string): number {
  const mapping: Record<string, number> = {
    'tap': EventType.CLICK,
    'click': EventType.CLICK,
    'longPress': EventType.LONG_PRESS,
    'doubleTap': EventType.DOUBLE_TAP,
    'hover': EventType.HOVER,
    'focus': EventType.FOCUS,
    'blur': EventType.BLUR,
  };
  return mapping[kind] ?? EventType.CLICK;
}

// ============================================
// MODIFIER COMPILATION
// ============================================

function compileModifier(nodeId: number, modifier: Modifier): 
  | { opcode: string; nodeId: number; propertyId: number; value: PropertyValue }
  | { opcode: string; nodeId: number; propertyId: number; value: PropertyValue }[]
  | null {
  const { kind, value, color } = modifier;
  
  switch (kind) {
    case 'padding':
      return {
        opcode: 'SET_PROPERTY',
        nodeId,
        propertyId: StackProperty.PADDING,
        value: { type: 'f32', value }
      };
    
    case 'background':
      return {
        opcode: 'SET_PROPERTY',
        nodeId,
        propertyId: StyleProperty.BACKGROUND_COLOR,
        value: compileColor(color)
      };
    
    case 'color':
      return {
        opcode: 'SET_PROPERTY',
        nodeId,
        propertyId: StyleProperty.COLOR,
        value: compileColor(color)
      };
    
    case 'fontSize':
      return {
        opcode: 'SET_PROPERTY',
        nodeId,
        propertyId: StyleProperty.FONT_SIZE,
        value: { type: 'f32', value }
      };
    
    case 'fontWeight':
      return {
        opcode: 'SET_PROPERTY',
        nodeId,
        propertyId: StyleProperty.FONT_WEIGHT,
        value: { type: 'u32', value }
      };
    
    case 'opacity':
      return {
        opcode: 'SET_PROPERTY',
        nodeId,
        propertyId: StyleProperty.OPACITY,
        value: { type: 'f32', value }
      };
    
    case 'visible':
      return {
        opcode: 'SET_PROPERTY',
        nodeId,
        propertyId: StyleProperty.VISIBLE,
        value: { type: 'u8', value: value ? 1 : 0 }
      };
    
    case 'margin':
      return {
        opcode: 'SET_PROPERTY',
        nodeId,
        propertyId: 0x1011,
        value: { type: 'f32', value }
      };
    
    case 'gap':
      return {
        opcode: 'SET_PROPERTY',
        nodeId,
        propertyId: StackProperty.SPACING,
        value: { type: 'f32', value }
      };
    
    case 'border': {
      // Border with both width and color
      const commands: any[] = [
        {
          opcode: 'SET_PROPERTY',
          nodeId,
          propertyId: StyleProperty.BORDER_WIDTH,
          value: { type: 'f32', value: modifier.width }
        }
      ];
      if (modifier.color) {
        commands.push({
          opcode: 'SET_PROPERTY',
          nodeId,
          propertyId: StyleProperty.BORDER_COLOR,
          value: compileColor(modifier.color)
        });
      }
      return commands;
    }

    case 'borderWidth':
      return {
        opcode: 'SET_PROPERTY',
        nodeId,
        propertyId: StyleProperty.BORDER_WIDTH,
        value: { type: 'f32', value: modifier.value }
      };

    case 'borderColor':
      return {
        opcode: 'SET_PROPERTY',
        nodeId,
        propertyId: StyleProperty.BORDER_COLOR,
        value: compileColor(modifier.value)
      };

    case 'cornerRadius':
      return {
        opcode: 'SET_PROPERTY',
        nodeId,
        propertyId: StyleProperty.BORDER_RADIUS,
        value: { type: 'f32', value: modifier.value }
      };

    default:
      console.warn(`Unknown modifier: ${kind}`);
      return null;
  }
}

// ============================================
// GESTURE COMPILATION
// ============================================

let gestureHandlerId = 0;
const gestureHandlers = new Map<number, Map<number, () => void>>();

function compileGesture(nodeId: number, gesture: Gesture): { opcode: string; nodeId: number; eventType: number; handlerId: number } {
  const eventType = mapGestureKind(gesture.kind);
  const handlerId = ++gestureHandlerId;
  
  let handlers = gestureHandlers.get(nodeId);
  if (!handlers) {
    handlers = new Map();
    gestureHandlers.set(nodeId, handlers);
  }
  handlers.set(eventType, gesture.handler);
  
  return {
    opcode: 'REGISTER_EVENT_HANDLER',
    nodeId,
    eventType,
    handlerId
  };
}

export function handleDispatchEvent(targetId: number, eventType: number): void {
  const handlers = gestureHandlers.get(targetId);
  if (handlers) {
    const handler = handlers.get(eventType);
    if (handler) {
      handler();
    }
  }
}

// Registry to store parent context for conditional placeholder nodes
// Key: placeholder nodeId, Value: { parentId: number, index: number }
const conditionalParentContext = new Map<number, { parentId: number; index: number }>();

// Export for use by ViewNode.if()
export function registerConditionalParent(nodeId: number, parentId: number, index: number): void {
  conditionalParentContext.set(nodeId, { parentId, index });
}

export function getConditionalParent(nodeId: number): { parentId: number; index: number } | undefined {
  return conditionalParentContext.get(nodeId);
}

// ============================================
// NODE COMPILATION
// ============================================

type InternalCommand = {
  opcode: string;
  nodeId?: number;
  propertyId?: number;
  value?: PropertyValue;
  parentId?: number;
  childId?: number;
  index?: number;
  componentType?: number;
  properties?: Map<number, PropertyValue>;
  eventType?: number;
  handlerId?: number;
};

function compileNode(node: ViewNode, parentId?: number, index?: number): InternalCommand[] {
  const commands: InternalCommand[] = [];
  
  // Skip control flow placeholder nodes - they are handled entirely by Signal subscriptions
  // and should not generate any CREATE_NODE command
  if (node.type === 'if' || node.type === 'for' || node.type === 'switch') {
    // Register parent context for this placeholder so Signal subscription can use it
    if (parentId !== undefined) {
      registerConditionalParent(node.nodeId, parentId, index ?? 0);
    }
    
    // For 'if' nodes, check for initial content
    if (node.type === 'if') {
      const contentNode = (node as any)._contentNode as ViewNode | undefined;
      
      if (contentNode && parentId !== undefined) {
        // Compile the content node as if it's a direct child of the parent
        const childCommands = compileNode(contentNode, parentId, index ?? 0);
        commands.push(...childCommands);
        
        // Also add INSERT_CHILD command since compileNode doesn't do it for conditional content
        commands.push({
          opcode: 'INSERT_CHILD',
          parentId: parentId,
          childId: contentNode.nodeId,
          index: index ?? 0
        });
      }
    }
    
    // For 'for' nodes, compile initial items
    if (node.type === 'for' && parentId !== undefined) {
      const initialItems = (node as any)._forInitialItems as any[] | undefined;
      const renderItem = (node as any)._forRenderItem as ((item: any, index: number, array: any[]) => ViewNode) | undefined;
      const itemNodes = (node as any)._forItemNodes as Map<number, { node: ViewNode; item: any }> | undefined;
      
      if (initialItems && renderItem && itemNodes && initialItems.length > 0) {
        // Get the items from the signal
        const signal = (node as any)._forItems as Signal<any[]>;
        const currentItems = signal.get();
        
        for (let i = 0; i < currentItems.length; i++) {
          const entry = itemNodes.get(node.nodeId * 10000 + i);
          if (entry) {
            const childCommands = compileNode(entry.node, parentId, index! + i);
            commands.push(...childCommands);
            
            // INSERT_CHILD is already added by compileNode
          }
        }
      }
    }
    
    // For 'switch' nodes, compile initial active content
    if (node.type === 'switch' && parentId !== undefined) {
      const initialNode = (node as any)._switchActiveNode as ViewNode | undefined;
      
      if (initialNode) {
        // Compile the active node as if it's a direct child of the parent
        const childCommands = compileNode(initialNode, parentId, index ?? 0);
        commands.push(...childCommands);
        
        // Also add INSERT_CHILD command since compileNode doesn't do it for conditional content
        commands.push({
          opcode: 'INSERT_CHILD',
          parentId: parentId,
          childId: initialNode.nodeId,
          index: index ?? 0
        });
      }
    }
    
    return commands;
  }
  
  const createCmd: InternalCommand = {
    opcode: 'CREATE_NODE',
    nodeId: node.nodeId,
    componentType: mapType(node.type),
    properties: new Map<number, PropertyValue>()
  };
  
  for (const [key, val] of Object.entries(node.properties)) {
    const propId = propertyNameToId(key);
    if (propId !== undefined && createCmd.properties) {
      createCmd.properties.set(propId, compilePropertyValue(propId, val));
    }
  }
  
  commands.push(createCmd);
  
  for (const modifier of node.modifiers) {
    const cmdOrCmds = compileModifier(node.nodeId, modifier);
    if (cmdOrCmds) {
      if (Array.isArray(cmdOrCmds)) {
        commands.push(...cmdOrCmds);
      } else {
        commands.push(cmdOrCmds);
      }
    }
  }
  
  for (const gesture of node.gestures) {
    commands.push(compileGesture(node.nodeId, gesture));
  }
  
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    commands.push(...compileNode(child, node.nodeId, i));
    
    // Only add INSERT_CHILD for non-conditional children
    if (child.type !== 'if' && child.type !== 'for' && child.type !== 'switch') {
      commands.push({
        opcode: 'INSERT_CHILD',
        parentId: node.nodeId,
        childId: child.nodeId,
        index: i
      });
    }
  }
  
  return commands;
}

// ============================================
// INITIAL RENDER
// ============================================

export function initialRender(root: ViewNode, transport: any): void {
  gestureHandlerId = 0;
  gestureHandlers.clear();
  
  commandQueue.setTransport(transport);
  
  const commands = compileNode(root);
  // Insert the root node as a child of the container (ID 0)
  // The root node will have ID 1 (first node created after reset)
  if (root.nodeId !== 0) {
    commands.push({
      opcode: 'INSERT_CHILD',
      parentId: 0,
      childId: root.nodeId,
      index: 0
    });
  }
  transport.send(commands);
}
