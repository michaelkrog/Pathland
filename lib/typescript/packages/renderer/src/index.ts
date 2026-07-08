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
 * The application owns the canonical UI tree - renderers only execute commands.
 * 
 * @example
 * ```typescript
 * import { Renderer } from '@pathland/renderer';
 * import { DOMRenderer } from '@pathland/renderer-dom';
 * 
 * const renderer: Renderer = new DOMRenderer(container);
 * renderer.executeCommands(commands);
 * ```
 */
export interface Renderer {
  /**
   * Execute a batch of commands.
   * This is the only required method - renderers receive command batches and execute them.
   * 
   * @param commands Array of Pathland commands to execute
   */
  executeCommands(commands: Command[]): void;
}

/**
 * Extended renderer interface with optional capabilities.
 * This allows renderers to provide additional functionality without
 * breaking the core stateless principle.
 */
export interface ExtendedRenderer extends Renderer {
  /**
   * Get the underlying native element for a node (for event routing).
   * This is the ONLY allowed state: nodeId -> element mapping.
   * 
   * @param nodeId The node ID to look up
   * @returns The native element or undefined if not found
   */
  getElement?(nodeId: number): unknown;

  /**
   * Clear all rendered elements.
   */
  clear?(): void;

  /**
   * Get the root container.
   */
  getContainer?(): unknown;

  /**
   * Process a binary-encoded message directly.
   * Optional convenience method for renderers that receive binary messages.
   * 
   * @param buffer Binary message containing commands
   */
  processMessage?(buffer: Uint8Array): void;

  /**
   * Execute a single command.
   * Optional convenience method.
   * 
   * @param command The Pathland command to execute
   */
  execute?(command: Command): void;
}

// Re-export Command type for convenience
export type { Command };
