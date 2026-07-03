/**
 * Advanced Pathland View App Example
 * 
 * Demonstrates an Angular-like class-based approach with fine-grained reactivity
 * Only changed elements generate Pathland commands - no tree diffing
 */

import { VStack, HStack, Text, Signal, initialRender, ViewNode } from '../dist/index';

// Create a simple transport that logs commands to console
class ConsoleTransport {
  send(commands: any[]) {
    console.log('Sending commands:', JSON.stringify(commands, null, 2));
  }
}

// ============================================
// REACTIVE VIEW COMPONENTS
// ============================================

/**
 * Base View class similar to Angular
 * Provides a declarative way to define UI components
 */
abstract class View {
  /**
   * Create a ViewNode from this view
   */
  abstract body(): ViewNode;

  /**
   * Static factory method to create a ViewNode
   */
  static make<T extends View>(this: new () => T): ViewNode {
    const instance = new this();
    return instance.body();
  }
}

/**
 * Card component that can be expanded/collapsed
 */
class Card extends View {
  private expanded = new Signal(false);
  private title: string;

  constructor(title: string) {
    super();
    this.title = title;
  }

  toggle() {
    this.expanded.set(!this.expanded.get());
  }

  body(): ViewNode {
    return VStack(
      HStack(
        Text(this.title).fontSize(18).fontWeight(600),
        Text(this.expanded.get() ? '[-]' : '[+]').tapGesture(() => this.toggle())
      ).justification('space-between').padding(8),
      this.expanded.get() ? 
        Text('This is the expanded content. It will only generate commands when the expanded signal changes.').padding(8) :
        undefined
    )
      .background('surface')
      .padding(4)
      .gap(4);
  }
}

/**
 * Counter component with increment/decrement buttons
 */
class Counter extends View {
  private count = new Signal(0);

  increment() {
    this.count.set(this.count.get() + 1);
  }

  decrement() {
    this.count.set(this.count.get() - 1);
  }

  body(): ViewNode {
    return HStack(
      Text('-').tapGesture(() => this.decrement()).padding(8),
      Text(this.count.map(n => `Count: ${n}`)).fontSize(16).padding(8),
      Text('+').tapGesture(() => this.increment()).padding(8)
    )
      .background('primary')
      .padding(4);
  }
}

/**
 * Message component that can show/hide
 */
class Message extends View {
  private visible = new Signal(true);
  private message: string;

  constructor(message: string) {
    super();
    this.message = message;
  }

  toggle() {
    this.visible.set(!this.visible.get());
  }

  body(): ViewNode {
    // Note: In a real implementation, we'd handle conditional rendering
    // by only including the node when visible
    return Text(this.message).padding(8).background('accent');
  }
}

// ============================================
// ROOT APPLICATION
// ============================================

/**
 * Root application view
 * Declares UI and reactive state bindings
 */
class App extends View {
  private liked = new Signal(false);

  save() {
    console.log("Saving:", this.liked.get());
  }

  body(): ViewNode {
    return VStack(
      Text('Advanced Pathland Demo').fontSize(24).fontWeight(700).padding(16),
      
      // Card that can be expanded
      Card.make('Expandable Card'),
      
      // Counter component
      Counter.make(),
      
      // Message that can be toggled
      Text('Toggle Message').tapGesture(() => {
        // Would toggle message visibility
        console.log('Message toggled');
      }).padding(8),
      
      // Like button with reactive text
      HStack(
        Text(this.liked.map(liked => liked ? '❤️ Liked' : '🤍 Like'))
          .tapGesture(() => this.liked.set(!this.liked.get()))
      ).padding(16).background('background'),
      
      // Save button
      Text('Save').tapGesture(() => this.save()).padding(16)
    )
      .padding(16)
      .background('background')
      .gap(8);
  }
}

// ============================================
// INITIALIZE AND RUN
// ============================================

console.log('=== Pathland Advanced App Demo ===\n');

const transport = new ConsoleTransport();
const app = new App();
const root = app.body();

console.log('Initial rendering...\n');
initialRender(root, transport);

console.log('\n=== Simulating user interactions ===\n');

// Simulate clicking the like button
console.log('Clicking like button...');
app['liked'].set(true);

console.log('\nClicking like button again...');
app['liked'].set(false);

console.log('\nAll commands have been queued and sent!');
console.log('\nNote: Each signal change generates only the necessary SET_PROPERTY commands.');
console.log('No tree diffing is performed - only the changed properties are updated.');
