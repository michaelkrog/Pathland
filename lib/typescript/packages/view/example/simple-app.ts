/**
 * Simple Pathland View App Example
 * 
 * Demonstrates creating a simple UI with VStack, HStack, Text, and gesture handling
 */

import { VStack, HStack, Text, Signal, initialRender, commandQueue } from '../dist/index';

// Create a simple transport that logs commands to console
class ConsoleTransport {
  send(commands: any[]) {
    console.log('Sending commands:', JSON.stringify(commands, null, 2));
    // In a real app, this would send to a renderer via postMessage or other transport
  }
}

// Create signals for reactive state
const counter = new Signal(0);
const showMessage = new Signal(true);
const isExpanded = new Signal(false);

// Create a simple view
function createAppView() {
  return VStack(
    Text('Pathland View Example'),
    Text(counter.map(n => `Counter: ${n}`)).fontSize(24).color('primary'),
    HStack(
      Text('Click me').tapGesture(() => counter.set(counter.get() + 1)),
      Text('Reset').tapGesture(() => counter.set(0))
    ).spacing(8).padding(16),
    
    // Conditionally shown message
    showMessage.get() ? Text('Hello from Pathland!').padding(8).background('blue') : undefined,
    
    // Expandable section
    VStack(
      Text('Toggle Section').tapGesture(() => isExpanded.set(!isExpanded.get())),
      isExpanded.get() ? Text('Expanded content visible!') : undefined
    ).padding(8).background('surface'),
    
    HStack(
      Text('Hide Message').tapGesture(() => showMessage.set(false)),
      Text('Show Message').tapGesture(() => showMessage.set(true))
    ).spacing(8).padding(8)
  )
    .padding(16)
    .background('background');
}

// Initialize the app
const transport = new ConsoleTransport();
const root = createAppView();

console.log('Initial rendering...');
initialRender(root, transport);

console.log('\nChanging counter value...');
counter.set(5);

console.log('\nToggling message visibility...');
showMessage.set(false);

console.log('\nExpanding section...');
isExpanded.set(true);

console.log('\nAll commands have been queued and sent!');
