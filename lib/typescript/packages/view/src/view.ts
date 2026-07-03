/**
 * @pathland/view - View Base Class
 * 
 * Base class for creating custom views with class-based syntax.
 * Provides static make() factory method for Angular-like instantiation.
 */

import type { ViewNode } from './view-node';

/**
 * Base class for all Pathland views.
 * 
 * Subclasses must implement the body() method to return their ViewNode tree.
 * The static make() method provides a clean factory pattern without using 'new'.
 * 
 * @example
 * ```typescript
 * class MyView extends View {
 *   body(): ViewNode {
 *     return VStack(Text('Hello'));
 *   }
 * }
 * 
 * // Usage - no 'new' required
 * const view = MyView.make();
 * ```
 */
export abstract class View {
  /**
   * Create the ViewNode tree for this view.
   * Must be implemented by subclasses.
   */
  abstract body(): ViewNode;

  /**
   * Static factory method that creates an instance and returns its body.
   * This allows Angular-like syntax: `MyView.make()` instead of `new MyView().body()`.
   * 
   * @param args - Constructor arguments for the view class
   * @returns The ViewNode tree from the view's body() method
   */
  static make<T extends View>(
    this: new (...args: any[]) => T,
    ...args: any[]
  ): ViewNode {
    return new this(...args).body();
  }
}
