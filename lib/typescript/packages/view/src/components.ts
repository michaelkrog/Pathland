/**
 * @pathland/view - Component Factories
 * 
 * Factory functions for creating Pathland ViewNodes.
 * These are the core building blocks for creating UI.
 */

import { ViewNode } from './view-node';
import { Signal } from './signal';

// ============================================
// CORE COMPONENTS
// ============================================

/**
 * Create a vertical stack layout component.
 * 
 * @param children Child nodes to stack vertically
 * @returns A VStack ViewNode
 * 
 * @example
 * ```typescript
 * VStack(
 *   Text("Item 1"),
 *   Text("Item 2"),
 *   Text("Item 3")
 * ).spacing(8).padding(16)
 * ```
 */
export function VStack(...children: ViewNode[]): ViewNode {
  return new ViewNode('VStack', children);
}

/**
 * Create a horizontal stack layout component.
 * 
 * @param children Child nodes to stack horizontally
 * @returns An HStack ViewNode
 * 
 * @example
 * ```typescript
 * HStack(
 *   Text("Left"),
 *   Text("Right")
 * ).spacing(8).padding(16)
 * ```
 */
export function HStack(...children: ViewNode[]): ViewNode {
  return new ViewNode('HStack', children);
}

/**
 * Create a text component.
 * 
 * @param content The text content (string or signal)
 * @returns A Text ViewNode
 * 
 * @example
 * ```typescript
 * // Static text
 * Text("Hello World")
 * 
 * // Dynamic text with signal
 * const count = new Signal(0);
 * Text(count.map(n => `Count: ${n}`))
 * 
 * // With modifiers
 * Text("Title").fontSize(24).color("primary")
 * ```
 */
export function Text(content: Signal<string> | string): ViewNode {
  const node = new ViewNode('Text');
  
  if (content instanceof Signal) {
    // Bind signal to text property
    node.bindSignal(content, 'text');
  } else {
    node.properties.text = content;
  }
  
  return node;
}

// ============================================
// EXPORTS
// ============================================

export { ViewNode } from './view-node';
