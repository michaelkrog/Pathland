/**
 * @pathland/platform-browser
 * 
 * Worker entry point that handles message communication between main thread and worker.
 * This file contains the standard worker message handling logic.
 * 
 * When a worker is created, this code sets up the message handler and manages
 * the view lifecycle in the worker thread.
 */

// Store reference to the event handler
let handleDispatchEventRef: ((nodeId: number, eventType: number) => void) | null = null;

/**
 * Start the worker with the specified view module path or View class.
 * This function sets up the message handler and initializes the view.
 * 
 * Can be called in two ways:
 * 1. startWorker(appModulePath) - imports the module at runtime
 * 2. startWorker(undefined, ViewClass) - uses the provided View class directly
 * 
 * @param appModulePath - Optional path to the module that exports the view class
 * @param ViewClass - Optional View class to use directly (if appModulePath is not provided)
 */
export function startWorker(appModulePath: string | undefined, ViewClass?: any): void {
  // Store the appModulePath and ViewClass for use in the message handler
  const storedModulePath = appModulePath;
  const storedViewClass = ViewClass;
  
  // Listen for messages from the main thread
  self.onmessage = async (event) => {
    const data = event.data;

    if (data.type === 'INIT') {
      try {
        let finalViewClass = storedViewClass;
        
        // If we don't have a stored ViewClass, try to import from the module path
        if (!finalViewClass) {
          // Use the provided appModulePath or the one from INIT message
          const path = storedModulePath || data.viewModulePath;
          
          // Import the view module using the provided path
          const appModule = await import(path);
          
          // Get the View class from the module (try default export first)
          finalViewClass = appModule.default;
          
          // If default export not found, try named export using viewClassName
          if (!finalViewClass && data.viewClassName) {
            finalViewClass = appModule[data.viewClassName];
          }

          if (!finalViewClass) {
            throw new Error(`View class ${data.viewClassName || 'default'} not found in module ${path}`);
          }
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
        const root = finalViewClass.make();
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
  
  // If we have a stored ViewClass, trigger initialization immediately
  if (storedViewClass) {
    self.postMessage({
      type: 'INIT',
      viewModulePath: '',
      viewClassName: 'default'
    });
  }
  // If we have a stored appModulePath, trigger initialization immediately
  else if (storedModulePath) {
    self.postMessage({
      type: 'INIT',
      viewModulePath: storedModulePath,
      viewClassName: 'default'
    });
  }
}

// Auto-start if this file is loaded as a worker
// This allows the file to be used directly as a worker entry
if (typeof self !== 'undefined' && self.onmessage) {
  // Try to extract the app module path from a data attribute or similar
  // For now, this is just a placeholder - the actual startWorker will be
  // called by the generated worker script in bootstrap.ts
}
