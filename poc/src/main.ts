/**
 * Pathland POC Main Entry Point
 * 
 * This uses the new @pathland/platform-browser package to bootstrap
 * the application with a simple, Angular-like API.
 */

import { bootstrapApplication } from '../../lib/typescript/packages/platform-browser';
import { POCApp } from './app';

// Bootstrap the application
// This will:
// 1. Find the <app-root> element
// 2. Set up the DOMRenderer
// 3. Configure event handling (click/tap)
// 4. Initialize the POCApp view
bootstrapApplication(POCApp)
  .then(() => {
    console.log('✅ Pathland POC application started successfully!');
  })
  .catch((error) => {
    console.error('❌ Failed to bootstrap Pathland application:', error);
  });
