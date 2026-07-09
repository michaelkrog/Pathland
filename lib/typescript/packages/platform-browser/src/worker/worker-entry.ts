/**
 * @pathland/platform-browser
 * 
 * Worker entry file that is processed by Vite.
 * This file is the actual entry point for the worker thread.
 * Vite will process this file and handle module imports correctly.
 */

// Import the actual worker entry logic
import './entry';

// This file exists to give Vite something to process as a worker entry point
// The actual worker logic is in entry.ts
export {};

/**
 * Worker entry function that can be imported and used in custom worker files.
 * This allows the worker to be processed by Vite with the correct module resolution.
 */
export function workerEntry() {
  // The actual worker logic is set up by importing './entry' above
  // This function is just a placeholder to export the worker functionality
}
