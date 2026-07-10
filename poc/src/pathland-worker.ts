/**
 * Pathland Worker Entry for POC
 * 
 * This file is processed by Vite as a worker.
 * It imports the platform-browser worker entry which contains the actual logic.
 */

// Import the worker entry from platform-browser
// This will set up the message handler on self.onmessage
import '@pathland/platform-browser/src/worker/entry';

// This file just needs to exist so Vite can process it as a worker
// The actual worker logic is in the entry.ts file
