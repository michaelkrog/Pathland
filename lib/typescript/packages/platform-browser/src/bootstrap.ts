/**
 * @pathland/platform-browser
 * 
 * Bootstrap utility for Pathland applications in the browser.
 * Provides a simple, Angular-like bootstrap function that handles
 * renderer setup, transport configuration, and view initialization.
 */

/**
 * Bootstrap a Pathland application in the browser.
 * 
 * This is the main entry point for Pathland applications. It automatically:
 * - Finds the <app-root> element as the rendering container
 * - Sets up the DOMRenderer
 * - Configures the command transport
 * - Initializes the root view
 *
 * @param viewClass - Your root view class with a static make() method
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

  // 2. Import required packages dynamically
  const [rendererModule, viewModule] = await Promise.all([
    import('@pathland/renderer-dom'),
    import('@pathland/view')
  ]);

  // 3. Set up renderer
  const renderer = new rendererModule.DOMRenderer(container as HTMLElement);

  // 4. Set up transport - commands go directly to renderer
  (viewModule.commandQueue as any).setTransport({
    send: (commands: any[]) => {
      renderer.executeCommands(commands);
    }
  });

  // 5. Create root view and initialize
  // viewClass.make() returns the ViewNode tree
  const root = viewClass.make();
  viewModule.initialRender(root, viewModule.commandQueue);
}

export default bootstrapApplication;
