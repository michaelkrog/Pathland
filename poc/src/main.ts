/**
 * Pathland POC Main Entry Point
 * 
 * Uses relative imports to lib packages.
 */

import { DOMRenderer } from '../../lib/typescript/packages/renderer-dom/src/index';
import { initialRender, handleDispatchEvent } from '../../lib/typescript/packages/view/src';
import { POCApp } from './app';

// Set up renderer
const container = document.querySelector('app-root');
if (!container) {
  throw new Error('Could not find <app-root> element. Add <app-root></app-root> to your HTML.');
}

const renderer = new DOMRenderer(container as HTMLElement);

// Set up transport - commands go directly to renderer
const transport = {
  send: (commands: any[]) => {
    console.log('Transport.send called with commands:', commands);
    renderer.executeCommands(commands);
    console.log('Renderer elements after execution:', Array.from(renderer['elements'].keys()));
  }
};

// Set up event delegation on the container
container.addEventListener('click', ((event: Event) => {
  // Find the closest element with a pathland node ID
  let target = event.target as HTMLElement;
  while (target && !target.dataset.pathlandNodeId) {
    target = target.parentElement as HTMLElement;
  }
  
  if (target && target.dataset.pathlandNodeId) {
    const nodeId = parseInt(target.dataset.pathlandNodeId, 10);
    // Map HTML events to Pathland event types
    // For now, map click to CLICK (0x04)
    const eventType = 0x04; // EventType.CLICK
    handleDispatchEvent(nodeId, eventType);
  }
}) as EventListener);

// Create root view and initialize
const root = POCApp.make();
initialRender(root, transport);

console.log('✅ Pathland POC application started successfully!');
