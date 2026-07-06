/**
 * @pathland/platform-browser
 * 
 * Bootstrap utility for Pathland applications in the browser.
 * Provides a simple, Angular-like bootstrap function that handles
 * renderer setup, transport configuration, view initialization, and event handling.
 */

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
 * - Sets up the DOMRenderer
 * - Configures the command transport
 * - Initializes the root view
 * - Sets up event delegation for gestures (tap, etc.)
 *
 * @param viewClass - Your root view class with a static make() method
 * @param commandQueue - Optional command queue to use (defaults to importing view module's commandQueue)
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
 * ```html
 * <!-- Required in your HTML -->
 * <body>
 *   <app-root></app-root>
 * </body>
 * ```
 */
export async function bootstrapApplication(
  viewClass: { make(...args: any[]): any }
): Promise<void> {
  // 1. Find <app-root> - always the same, no configuration needed
  const container = document.querySelector('app-root');
  if (!container) {
    throw new Error('Could not find <app-root> element. Add <app-root></app-root> to your HTML.');
  }

  // 2. Lazy load required packages
  const [rendererMod, viewMod] = await Promise.all([
    loadRendererModule(),
    loadViewModule()
  ]);

  // 3. Set up renderer
  const renderer = new rendererMod.DOMRenderer(container as HTMLElement);

  // 4. Set up transport - commands go directly to renderer
  const transport = {
    send: (commands: any[]) => {
      renderer.executeCommands(commands);
    }
  };

  // 5. Set up event delegation on the container
  // This captures click/tap events and dispatches them to the view
  container.addEventListener('click', ((event: Event) => {
    // Find the closest element with a pathland node ID
    let target = event.target as HTMLElement;
    while (target && !target.dataset.pathlandNodeId) {
      target = target.parentElement as HTMLElement;
    }
    
    if (target && target.dataset.pathlandNodeId) {
      const nodeId = parseInt(target.dataset.pathlandNodeId, 10);
      // Map HTML events to Pathland event types
      // For now, map click to CLICK (0x04) and TAP (0x01)
      const eventType = 0x04; // EventType.CLICK
      viewMod.handleDispatchEvent(nodeId, eventType);
    }
  }) as EventListener);

  // TODO: Add support for other event types (long press, hover, etc.)

  // 6. Create root view and initialize
  // viewClass.make() returns the ViewNode tree
  const root = viewClass.make();
  viewMod.initialRender(root, transport);
}

export default bootstrapApplication;
