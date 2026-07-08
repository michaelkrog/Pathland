/**
 * @pathland/renderer
 * 
 * Base Renderer interface for Pathland protocol.
 * All Pathland renderers (DOM, Canvas, WebGL, etc.) implement this interface.
 */

import type { Command } from '@pathland/protocol';

/**
 * Minimal renderer interface for Pathland protocol.
 * 
 * Renderers MUST be stateless (except for nodeId -> element mapping for event routing).
 * The application owns the canonical UI tree - renderers only execute commands and handle events.
 * 
 * @example
 * ```typescript
 * import { Renderer } from '@pathland/renderer';
 * import { DOMRenderer } from '@pathland/renderer-dom';
 * 
 * const renderer: Renderer = new DOMRenderer(container);
 * 
 * // Set up event dispatching
 * renderer.setupEvents((nodeId, eventType) => {
 *   // Handle events from the renderer
 *   handleDispatchEvent(nodeId, eventType);
 * });
 * 
 * // Execute commands
 * renderer.executeCommands(commands);
 * ```
 */
export interface Renderer {
  /**
   * Execute a batch of Pathland commands.
   * The renderer processes each command and updates its output accordingly.
   * 
   * @param commands Array of Pathland commands to execute
   */
  executeCommands(commands: Command[]): void;

  /**
   * Set up event handling for this renderer.
   * The renderer sets up its own event listeners (on DOM elements, canvas, etc.)
   * and calls the dispatchEvent callback when events occur.
   * 
   * @param dispatchEvent Callback function: (nodeId, eventType) => void
   *   - nodeId: The Pathland node ID that was the target of the event
   *   - eventType: The Pathland event type (e.g., 0x04 for CLICK)
   */
  setupEvents(dispatchEvent: (nodeId: number, eventType: number) => void): void;
}

// Re-export Command type for convenience
export type { Command };
