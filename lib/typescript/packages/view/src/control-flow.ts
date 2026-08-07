/**
 * @pathland/view - Control Flow
 * 
 * Angular-style control flow functions: If, For, Switch
 * These provide conditional rendering, iteration, and multi-way branching.
 */

import { ViewNode, resetNodeIdCounter } from './view-node';
import { Signal, commandQueue } from './signal';
import { propertyNameToId, compilePropertyValue } from './utils';
import { getConditionalParent } from './renderer';

// Local component type constants (avoid circular dependency with protocol)
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
// IF - Conditional Rendering
// ============================================

/**
 * Conditional rendering - displays content only when condition is true.
 * When condition is false, the content is completely removed from the tree.
 * 
 * @param condition The boolean signal or value that controls rendering
 * @param createContent Function that creates the ViewNode to display when condition is true
 * @returns A ViewNode placeholder that manages the conditional logic
 * 
 * @example
 * ```typescript
 * const visible = signal(true);
 * 
 * VStack(
 *   If(visible, () => Text("Show when visible")),
 *   Text("Always shown")
 * )
 * ```
 */
export function If(
  condition: Signal<boolean> | boolean,
  createContent: () => ViewNode
): ViewNode {
  // If it's a plain boolean, wrap it in a Signal
  const signal = condition instanceof Signal ? condition : new Signal(condition);
  
  return ViewNode.if(signal, createContent);
}

// ============================================
// FOR - Iteration
// ============================================

/**
 * Type for the item render function in For
 */
export type ForRenderFn<T> = (item: T, index: number, array: T[]) => ViewNode;

/**
 * Iteration control flow - renders content for each item in an array.
 * When the array changes, nodes are created, updated, or deleted as needed.
 * 
 * @param items Signal or array of items to iterate over
 * @param renderItem Function that creates a ViewNode for each item
 * @returns A ViewNode placeholder that manages the list
 * 
 * @example
 * ```typescript
 * const items = signal(["A", "B", "C"]);
 * 
 * VStack(
 *   For(items, (item, index) => Text(`${index}: ${item}`))
 * )
 * ```
 * 
 * @example
 * ```typescript
 * // With objects
 * const users = signal<User[]>([]);
 * For(users, (user, i) => 
 *   HStack(
 *     Text(user.name),
 *     Text(user.email)
 *   )
 * )
 * ```
 */
export function For<T>(
  items: Signal<T[]> | T[],
  renderItem: ForRenderFn<T>
): ViewNode {
  // Wrap plain array in Signal
  const signal = items instanceof Signal ? items : new Signal(items);
  
  // Create a placeholder node for the list
  const placeholder = new ViewNode('for', []);
  
  // Store metadata on the placeholder for compileNode to access
  (placeholder as any)._forItems = signal;
  (placeholder as any)._forRenderItem = renderItem;
  (placeholder as any)._forItemNodes = new Map<number, { node: ViewNode; item: T }>();
  
  // Track created nodes for each item
  // Map of item key/index to { node: ViewNode, item: T }
  const itemNodes = (placeholder as any)._forItemNodes as Map<number, { node: ViewNode; item: T }>;
  
  // Function to get a stable key for an item at a given index
  function getItemKey(index: number): number {
    return placeholder.nodeId * 10000 + index;
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
  
  // Function to recursively send CREATE_NODE commands
  function sendCreateNodeRecursive(node: ViewNode, parentId: number, index: number): void {
    const componentType = getComponentType(node.type);
    
    commandQueue.add({
      opcode: 'CREATE_NODE',
      nodeId: node.nodeId,
      componentType: componentType,
      properties: new Map<number, any>()
    });
    
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
    
    commandQueue.add({
      opcode: 'INSERT_CHILD',
      parentId: parentId,
      childId: node.nodeId,
      index: index
    });
    
    for (let i = 0; i < node.children.length; i++) {
      sendCreateNodeRecursive(node.children[i], node.nodeId, i);
    }
  }
  
  // Function to recursively send DELETE_NODE commands
  function sendDeleteNodeRecursive(node: ViewNode): void {
    for (const child of node.children) {
      sendDeleteNodeRecursive(child);
    }
    commandQueue.add({
      opcode: 'DELETE_NODE',
      nodeId: node.nodeId
    });
  }
  
  // For initial render, create nodes for all items and store on placeholder
  const initialItems = signal.get();
  for (let i = 0; i < initialItems.length; i++) {
    const item = initialItems[i];
    const node = renderItem(item, i, initialItems);
    itemNodes.set(getItemKey(i), { node, item });
    placeholder.children.push(node);
  }
  
  // Store initial items on placeholder for compileNode
  (placeholder as any)._forInitialItems = initialItems;

  // Last array this For rendered, used to diff against on updates.
  let lastItems = initialItems;

  // Subscribe to array changes.
  // Uses positional identity diffing: items whose reference is unchanged at
  // the same index are reused (no commands), and only removed/replaced items
  // are deleted and new items created. Items that persist but shift position
  // are recreated (a keyed reconciliation with moves is a future enhancement).
  signal.subscribe((newItems: T[]) => {
    const parentContext = getConditionalParent(placeholder.nodeId);
    if (!parentContext) return;

    const { parentId, index: parentIndex } = parentContext;

    // Fast path: identical arrays (same length, same item references) -> no-op.
    if (
      newItems.length === lastItems.length &&
      newItems.every((item, i) => item === lastItems[i])
    ) {
      lastItems = newItems;
      return;
    }

    // Capture existing nodes before rebuilding the map.
    const oldNodes = new Map(itemNodes);

    // Delete nodes for items that were removed or replaced.
    for (let i = 0; i < lastItems.length; i++) {
      const reused = i < newItems.length && lastItems[i] === newItems[i];
      if (!reused) {
        const entry = oldNodes.get(getItemKey(i));
        if (entry) sendDeleteNodeRecursive(entry.node);
      }
    }

    // Reuse unchanged items and create nodes for new items.
    const nextChildren: ViewNode[] = [];
    itemNodes.clear();
    for (let i = 0; i < newItems.length; i++) {
      const reused = i < lastItems.length && lastItems[i] === newItems[i];
      const key = getItemKey(i);

      if (reused) {
        const entry = oldNodes.get(key);
        if (entry) {
          itemNodes.set(key, { node: entry.node, item: newItems[i] });
          nextChildren.push(entry.node);
          continue;
        }
      }

      const node = renderItem(newItems[i], i, newItems);
      itemNodes.set(key, { node, item: newItems[i] });
      nextChildren.push(node);
      sendCreateNodeRecursive(node, parentId, parentIndex + i);
    }

    placeholder.children = nextChildren;
    lastItems = newItems;
  });

  return placeholder;
}

// ============================================
// SWITCH - Multi-way Branch
// ============================================

/**
 * Type for switch cases - can be a value or a signal
 */
export type SwitchCaseValue = string | number | boolean | Signal<any>;

/**
 * Type for case handler function
 */
export type SwitchCaseHandler = (value: any) => ViewNode;

/**
 * Type for switch cases object
 * Supports string keys for case values, plus special '_' and 'default' keys for default case
 */
export type SwitchCases = {
  [key: string]: SwitchCaseHandler;
} & {
  _?: SwitchCaseHandler; // Default case (using _ as key)
  default?: SwitchCaseHandler; // Alternative default case
};

/**
 * Multi-way branching - displays the content for the matching case.
 * Supports a default case with '_' or 'default' key.
 * 
 * @param value The value or signal to match against
 * @param cases Object mapping case values to content creation functions
 * @returns A ViewNode placeholder that manages the switch logic
 * 
 * @example
 * ```typescript
 * const status = signal<"loading" | "error" | "success">("loading");
 * 
 * VStack(
 *   Switch(status, {
 *     loading: () => Spinner(),
 *     error: () => Text("Error!"),
 *     success: () => Text("Done!")
 *   })
 * )
 * ```
 * 
 * @example
 * ```typescript
 * // With default case
 * Switch(value, {
 *   a: () => Text("A"),
 *   b: () => Text("B"),
 *   _: () => Text("Other")  // Default
 * })
 * ```
 */
export function Switch(
  value: SwitchCaseValue,
  cases: SwitchCases
): ViewNode {
  // Track the current active content node
  let activeNode: ViewNode | null = null;
  const placeholder = new ViewNode('switch', []);
  
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
  
  // Function to recursively send CREATE_NODE commands
  function sendCreateNodeRecursive(node: ViewNode, parentId: number, index: number): void {
    const componentType = getComponentType(node.type);
    
    commandQueue.add({
      opcode: 'CREATE_NODE',
      nodeId: node.nodeId,
      componentType: componentType,
      properties: new Map<number, any>()
    });
    
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
    
    commandQueue.add({
      opcode: 'INSERT_CHILD',
      parentId: parentId,
      childId: node.nodeId,
      index: index
    });
    
    for (let i = 0; i < node.children.length; i++) {
      sendCreateNodeRecursive(node.children[i], node.nodeId, i);
    }
  }
  
  // Function to recursively send DELETE_NODE commands
  function sendDeleteNodeRecursive(node: ViewNode): void {
    for (const child of node.children) {
      sendDeleteNodeRecursive(child);
    }
    commandQueue.add({
      opcode: 'DELETE_NODE',
      nodeId: node.nodeId
    });
  }
  
  // Get current value
  const getValue = (): any => {
    return value instanceof Signal ? value.get() : value;
  };
  
  // Find matching case
  const findMatchingCase = (val: any): SwitchCaseHandler | null => {
    // Check exact value matches
    for (const [caseKey, handler] of Object.entries(cases)) {
      if (caseKey === '_' || caseKey === 'default') continue;
      if (caseKey === String(val)) {
        return handler;
      }
    }
    // Check default case
    return cases._ || cases.default || null;
  };
  
  // Initial render
  const initialValue = getValue();
  const initialHandler = findMatchingCase(initialValue);
  if (initialHandler) {
    activeNode = initialHandler(initialValue);
    placeholder.children.push(activeNode);
  }
  
  // Store active node on placeholder for compileNode
  (placeholder as any)._switchActiveNode = activeNode;
  (placeholder as any)._switchValue = value;
  (placeholder as any)._switchCases = cases;
  
  // Subscribe to value changes (if it's a Signal)
  if (value instanceof Signal) {
    value.subscribe((newValue: any) => {
      const parentContext = getConditionalParent(placeholder.nodeId);
      if (!parentContext) return;
      
      const { parentId, index } = parentContext;
      
      // Find matching handler
      const handler = findMatchingCase(newValue);
      
      if (handler && (!activeNode || activeNode.nodeId === 0)) {
        // Create new node
        const newNode = handler(newValue);
        activeNode = newNode;
        placeholder.children = [newNode];
        sendCreateNodeRecursive(newNode, parentId, index);
      } else if (handler && activeNode) {
        // Update existing node - for now, delete and recreate
        // (A more sophisticated implementation would update properties only)
        sendDeleteNodeRecursive(activeNode);
        const newNode = handler(newValue);
        activeNode = newNode;
        placeholder.children = [newNode];
        sendCreateNodeRecursive(newNode, parentId, index);
      } else if (!handler && activeNode) {
        // No matching case, delete active node
        sendDeleteNodeRecursive(activeNode);
        activeNode = null;
        placeholder.children = [];
      }
    });
  }
  
  return placeholder;
}

// Re-export from view-node for convenience
export { ViewNode, resetNodeIdCounter };
