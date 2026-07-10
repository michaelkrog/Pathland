/**
 * @pathland/platform-browser
 * 
 * Worker entry point that handles both initialization and command processing.
 * This runs in the worker thread and manages view logic, command generation,
 * and communication with the main thread renderer.
 */

// Store reference to the event handler from view package
let handleDispatchEventRef: ((nodeId: number, eventType: number) => void) | null = null;

// Listen for messages from the main thread
self.onmessage = async (event) => {
  const data = event.data;

  if (data.type === 'INIT') {
    try {
      // Dynamically import the view module
      // The viewModulePath is passed from the main thread and should be
      // a path that the bundler can resolve (e.g., '/src/app.ts')
      const viewModulePath = data.viewModulePath;
      
      // Import the view module using the provided path
      // The bundler is responsible for making this work
      const viewModule = await import(/* @vite-ignore */ viewModulePath);
      
      // Get the View class from the module
      // Try both default export and named export
      let ViewClass = viewModule.default;
      if (!ViewClass && data.viewClassName) {
        ViewClass = viewModule[data.viewClassName];
      }

      if (!ViewClass) {
        throw new Error(`View class ${data.viewClassName || 'default'} not found in module ${viewModulePath}`);
      }

      // Import view utilities
      const { initialRender, handleDispatchEvent } = await import('@pathland/view');

      // Set up transport to main thread
      const transport = {
        send: (commands: any[]) => {
          postMessage({ type: 'COMMANDS', commands });
        },
        sendBinary: (buffer: Uint8Array) => {
          postMessage({ type: 'BINARY', buffer }, [buffer] as any);
        },
        onMessage: () => () => {},
        onError: () => () => {},
        close: () => {}
      };

      // Initialize the view
      const root = ViewClass.make();
      initialRender(root, transport);

      // Store event handler for later use
      handleDispatchEventRef = handleDispatchEvent;

      // Notify main thread that worker is ready
      postMessage({ type: 'READY' });
    } catch (error: any) {
      postMessage({ type: 'ERROR', error: error.message || String(error) });
    }
  }
  else if (data.type === 'EVENT') {
    // Handle event from main thread
    if (handleDispatchEventRef) {
      handleDispatchEventRef(data.nodeId, data.eventType);
    }
  }
};