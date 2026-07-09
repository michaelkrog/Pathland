/**
 * POC Worker Entry Point
 * 
 * This worker file is processed by Vite and can import view classes correctly.
 * It contains the actual worker logic that would normally be in the platform-browser
 * worker entry, but with the correct module resolution for the POC.
 * 
 * Note: This file must not use ES module exports as it runs in a worker context.
 */

// Store reference to the event handler from view package
let handleDispatchEventRef: ((nodeId: number, eventType: number) => void) | null = null;

// Listen for messages from the main thread
self.onmessage = async (event) => {
  const data = event.data;
  console.log('[Worker] Received message:', data.type);

  if (data.type === 'INIT') {
    console.log('[Worker] Initializing with viewModulePath:', data.viewModulePath, 'viewClassName:', data.viewClassName);
    try {
      // Import the view module using the path provided by the main thread
      // Vite will resolve this correctly because we're in the same context
      const viewModule = await import(/* @vite-ignore */ data.viewModulePath);
      const ViewClass = viewModule[data.viewClassName];

      if (!ViewClass) {
        throw new Error(`View class ${data.viewClassName} not found in module ${data.viewModulePath}`);
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