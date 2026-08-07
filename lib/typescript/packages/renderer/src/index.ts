/**
 * @pathland/renderer
 * 
 * Base Renderer interface for Pathland protocol.
 * All Pathland renderers (DOM, Canvas, WebGL, etc.) implement this interface.
 */

import type { Command, EventData } from '@pathland/protocol';

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
 * const renderer: Renderer = new DOMRenderer({ container });
 * 
 * // Set up event dispatching
 * renderer.setupEvents((nodeId, eventType, data) => {
 *   // Handle events from the renderer
 *   handleDispatchEvent(nodeId, eventType, data);
 * });
 * 
 * // Set up gesture dispatching
 * renderer.setupGestures((nodeId, gestureType, gestureState, data) => {
 *   handleGestureUpdate(nodeId, gestureType, gestureState, data);
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
   * @param dispatchEvent Callback: (nodeId, eventType, data?) => void
   *   - nodeId: The Pathland node ID that was the target of the event
   *   - eventType: The Pathland event type (e.g., 0x04 for CLICK)
   *   - data: The event payload (matches the protocol's DISPATCH_EVENT data)
   */
  setupEvents(dispatchEvent: (nodeId: number, eventType: number, data?: EventData) => void): void;

  /**
   * Set up gesture handling for this renderer.
   * The renderer runs gesture recognizers and calls dispatchGesture when a
   * recognized gesture changes state (began/changed/ended/cancelled).
   * 
   * @param dispatchGesture Callback: (nodeId, gestureType, gestureState, data?) => void
   *   - nodeId: The Pathland node ID the gesture was attached to
   *   - gestureType: The Pathland gesture type (e.g., 0x12 for DRAG)
   *   - gestureState: 0=began, 1=changed, 2=ended, 3=cancelled
   *   - data: The gesture payload (matches the protocol's GESTURE_UPDATE data)
   */
  setupGestures(dispatchGesture: (nodeId: number, gestureType: number, gestureState: number, data?: EventData) => void): void;
}

// Re-export Command type for convenience
export type { Command, EventData };
