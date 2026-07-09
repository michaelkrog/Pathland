/**
 * Pathland POC Main Entry Point
 * 
 * Uses the bootstrapApplication method from platform-browser package.
 */

import { bootstrapApplication } from '@pathland/platform-browser';
import { POCApp } from './app';

// Bootstrap the application using the platform-browser utility
// Use worker mode for better performance
bootstrapApplication(POCApp)
  .then(() => {
    console.log('✅ Pathland POC application started successfully with worker mode!');
  })
  .catch((error) => {
    console.error('❌ Failed to bootstrap Pathland application:', error);
    throw error;
  });
