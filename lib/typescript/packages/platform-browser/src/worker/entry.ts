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
      // The viewModulePath is resolved by the main thread and passed to the worker
      let viewModulePath = data.viewModulePath;
      
      // In browser environment with Vite dev, we need to resolve the path properly
      if (typeof window !== 'undefined' && typeof location !== 'undefined') {
        // If the path doesn't start with / or http, make it relative to origin
        if (!viewModulePath.startsWith('/') && !viewModulePath.startsWith('http')) {
          // Remove any leading ./ or ../ 
          viewModulePath = viewModulePath.replace(/^\.\/|^\.\.\//, '');
          viewModulePath = new URL(viewModulePath, window.location.origin).toString();
        } else if (viewModulePath.startsWith('/')) {
          // Ensure absolute paths have the correct origin
          viewModulePath = new URL(viewModulePath, window.location.origin).toString();
        }
      }
      
      const viewModule = await import(/* @vite-ignore */ viewModulePath);
      const ViewClass = viewModule[data.viewClassName];

      if (!ViewClass) {
        throw new Error(`View class ${data.viewClassName} not found in module ${viewModulePath}`);
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

export {}; // Make this a module