/**
 * @pathland/view
 * 
 * Pathland View Framework - Reactive, declarative UI for Pathland protocol.
 * 
 * This package provides a component-based, Angular-like API for building UI
 * that compiles to Pathland's binary protocol. It features fine-grained reactivity
 * where only changed properties generate update commands.
 * 
 * @example
 * ```typescript
 * import { VStack, HStack, Text, Signal, initialRender } from '@pathland/view';
 * import { PostMessageTransport } from '@pathland/transport';
 * 
 * class App {
 *   count = new Signal(0);
 *   
 *   createView() {
 *     return VStack(
 *       Text(this.count.map(n => `Count: ${n}`)),
 *       HStack(
 *         Text("+"),
 *         Text("-")
 *       ).tapGesture(() => this.count.set(this.count.get() + 1))
 *     );
 *   }
 * }
 * 
 * const app = new App();
 * const transport = new PostMessageTransport(iframe.contentWindow);
 * initialRender(app.createView(), transport);
 * ```
 */

// Re-export core types and functions
export type { Modifier, Gesture } from './view-node';
export { ViewNode, resetNodeIdCounter } from './view-node';
export { View } from './view';
export { Signal, commandQueue } from './signal';
export { VStack, HStack, Text } from './components';
export { initialRender, handleDispatchEvent, getConditionalParent } from './renderer';
export { propertyNameToId, compilePropertyValue } from './utils';

// Re-export control flow functions
export { If, For, Switch } from './control-flow';
export type { ForRenderFn, SwitchCaseValue, SwitchCaseHandler, SwitchCases } from './control-flow';

// Chainable methods are added to ViewNode.prototype in view-node.ts
// Available on any ViewNode:
// - .padding(value: number): ViewNode
// - .background(color: string | number): ViewNode
// - .color(color: string | number): ViewNode
// - .fontSize(value: number): ViewNode
// - .fontWeight(value: number): ViewNode
// - .margin(value: number): ViewNode
// - .gap(value: number): ViewNode
// - .spacing(value: number): ViewNode (alias for gap)
// - .opacity(value: number): ViewNode
// - .visible(value: boolean | Signal<boolean>): ViewNode
// - .tapGesture(handler: () => void): ViewNode
// - .longPressGesture(handler: () => void): ViewNode
