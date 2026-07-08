/**
 * @pathland/platform-browser
 * 
 * Bootstrap utility for Pathland applications in the browser.
 * Provides a simple, Angular-like bootstrap function that handles
 * renderer setup, transport configuration, view initialization, and event handling.
 */

import type { Renderer } from '@pathland/renderer';

// Lazy load the actual modules - these will be resolved by Vite at build time
// using the alias configuration
let rendererModule: any = null;
let viewModule: any = null;

async function loadRendererModule() {
  if (!rendererModule) {
    // Use package import for @pathland/renderer-dom
    rendererModule = await import('@pathland/renderer-dom');
  }
  return rendererModule;
}

async function loadViewModule() {
  if (!viewModule) {
    // Use package import for @pathland/view
    viewModule = await import('@pathland/view');
  }
  return viewModule;
}

/**
 * Bootstrap a Pathland application in the browser.
 * 
 * This is the main entry point for Pathland applications. It automatically:
 * - Finds the <app-root> element as the rendering container
 * - Sets up the renderer (DOMRenderer by default, or a custom renderer)
 * - Configures the command transport
 * - Initializes the root view
 * - Sets up event delegation for gestures (tap, etc.)
 *
 * @param viewClass - Your root view class with a static make() method
 * @param options - Optional bootstrap options including custom renderer
 * @returns Promise that resolves when the application is bootstrapped
 *
 * @example
 * ```typescript
 * import { bootstrapApplication } from '@pathland/platform-browser';
 * import { App } from './app';
 *
 * bootstrapApplication(App);
 * ```
 *
 * @example
 * ```typescript
 * // With a custom renderer
 * import { bootstrapApplication } from '@pathland/platform-browser';
 * import { MyCustomRenderer } from './my-renderer';
 * import { App } from './app';
 *
 * bootstrapApplication(App, { renderer: new MyCustomRenderer(container) });
 * ```
 *
 * @example
 * ```html
 * <!-- Required in your HTML -->
 * <body>
 *   <app-root></app-root>
 * </body>
 * ```
 */

/**
 * Options for bootstrapApplication.
 */
export interface BootstrapOptions {
  /**
   * Custom renderer to use instead of the default DOMRenderer.
   * Must implement the Renderer interface.
   */
  renderer?: Renderer;
}

export async function bootstrapApplication(
  viewClass: { make(...args: any[]): any },
  options: BootstrapOptions = {}
): Promise<void> {
  // 1. Find <app-root> - always the same, no configuration needed
  const container = document.querySelector('app-root');
  if (!container) {
    throw new Error('Could not find <app-root> element. Add <app-root></app-root> to your HTML.');
  }

  // 2. Lazy load required packages
  const [rendererMod, viewMod] = await Promise.all([
    options.renderer ? Promise.resolve({}) : loadRendererModule(),
    loadViewModule()
  ]);

  // 3. Set up renderer - use custom renderer if provided, otherwise create DOMRenderer
  const renderer: Renderer = options.renderer 
    ? options.renderer 
    : new rendererMod.DOMRenderer(container as HTMLElement);

  // 4. Set up transport - commands go directly to renderer
  const transport = {
    send: (commands: any[]) => {
      renderer.executeCommands(commands);
    }
  };

  // 5. Set up event handling - renderer sets up its own event listeners
  renderer.setupEvents((nodeId: number, eventType: number) => {
    viewMod.handleDispatchEvent(nodeId, eventType);
  });

  // TODO: Add support for other event types (long press, hover, etc.)

  // 6. Create root view and initialize
  // viewClass.make() returns the ViewNode tree
  const root = viewClass.make();
  viewMod.initialRender(root, transport);
}

export default bootstrapApplication;
