/**
 * @pathland/view - Signal
 * 
 * Reactive value that directly generates Pathland commands when changed.
 * This is the core of the fine-grained reactivity system.
 */

// Import types from protocol package
import type { PropertyValue, Command } from '@pathland/protocol';

// Re-export Command type for consistency
export type { Command };

/**
 * Singleton command queue for batching commands before sending to transport.
 * Uses microtask queue for automatic batching of rapid changes.
 */
export const commandQueue = {
  commands: [] as Command[],
  transport: null as any,
  flushScheduled: false,

  /**
   * Add commands to the queue.
   */
  add(...commands: Command[]): void {
    this.commands.push(...commands);
    this.scheduleFlush();
  },

  /**
   * Schedule a flush for the next microtask.
   */
  scheduleFlush(): void {
    if (!this.flushScheduled) {
      this.flushScheduled = true;
      queueMicrotask(() => {
        this.flushScheduled = false;
        this.flush();
      });
    }
  },

  /**
   * Immediately flush all queued commands to the transport.
   */
  flush(): void {
    if (this.commands.length > 0 && this.transport) {
      this.transport.send(this.commands);
      this.commands = [];
    }
  },

  /**
   * Set the transport for sending commands.
   */
  setTransport(t: any): void {
    this.transport = t;
  }
};

// ============================================
// BINDING TYPE
// ============================================

/**
 * Represents a binding between a signal and a ViewNode property.
 * When the signal changes, it will generate a SET_PROPERTY command for this binding.
 */
interface SignalBinding<T> {
  nodeId: number;
  propertyId: number;
  compile: (value: T) => PropertyValue;
}

// ============================================
// SIGNAL CLASS
// ============================================

/**
 * Reactive value that directly generates Pathland SET_PROPERTY commands
 * when its value changes.
 * 
 * @example
 * ```typescript
 * const count = new Signal(0);
 * 
 * // Bind to a Text node's text property
 * Text(count.map(n => `Count: ${n}`)).bindSignal(count, 'text');
 * 
 * // Later: changing the signal generates a command
 * count.set(5); // Generates: SET_PROPERTY { nodeId, propertyId: TEXT, value: "Count: 5" }
 * ```
 */
export class Signal<T> {
  private value: T;
  private bindings: SignalBinding<T>[] = [];

  /**
   * Create a new signal with an initial value.
   * @param initialValue The initial value of the signal
   */
  constructor(initialValue: T) {
    this.value = initialValue;
  }

  /**
   * Get the current value of the signal.
   */
  get(): T {
    return this.value;
  }

  /**
   * Set the value of the signal.
   * This will generate SET_PROPERTY commands for all bound nodes.
   * @param value The new value
   */
  set(value: T): void {
    if (this.value === value) return;
    this.value = value;
    
    // Generate commands for each binding
    for (const binding of this.bindings) {
      commandQueue.add({
        opcode: 'SET_PROPERTY',
        nodeId: binding.nodeId,
        propertyId: binding.propertyId,
        value: binding.compile(value)
      });
    }
    
    // Schedule flush (batches all changes in this tick)
    commandQueue.scheduleFlush();
  }

  /**
   * Bind this signal to a ViewNode property.
   * When the signal changes, it will generate a SET_PROPERTY command
   * for the specified node and property.
   * 
   * @param nodeId The node ID to bind to
   * @param propertyId The Pathland property ID
   * @param compile Optional function to transform the value to PropertyValue
   * @returns Unbind function
   */
  bind(nodeId: number, propertyId: number, compile: (value: T) => PropertyValue = defaultCompile): () => void {
    const binding: SignalBinding<T> = { nodeId, propertyId, compile };
    this.bindings.push(binding);
    
    return () => {
      const index = this.bindings.indexOf(binding);
      if (index !== -1) this.bindings.splice(index, 1);
    };
  }

  /**
   * Subscribe to signal changes with a custom callback.
   * This allows for arbitrary side effects when the signal changes,
   * such as structural tree modifications (CREATE_NODE, DELETE_NODE, etc.).
   * 
   * @param callback Function to call when the signal changes
   * @returns Unsubscribe function
   */
  subscribe(callback: (value: T) => void): () => void {
    // Create a dummy binding that calls our callback
    const binding: any = {
      nodeId: -1,
      propertyId: 0,
      compile: (value: T) => {
        callback(value);
        return { type: 'u8', value: 0 }; // Dummy return
      }
    };
    this.bindings.push(binding);
    
    return () => {
      const index = this.bindings.indexOf(binding);
      if (index !== -1) this.bindings.splice(index, 1);
    };
  }

  /**
   * Create a derived signal that maps this signal's value through a function.
   * The derived signal automatically updates when this signal changes.
   * 
   * @param fn Mapping function
   * @returns New derived signal
   */
  map<U>(fn: (value: T) => U): Signal<U> {
    const derived = new Signal(fn(this.value));
    
    // When this signal changes, update the derived signal
    this.bindings.push({
      nodeId: -1, // Special marker for derived signals
      propertyId: 0,
      compile: (v: T) => {
        derived.set(fn(v));
        return { type: 'u8', value: 0 }; // Dummy value, never used
      }
    });
    
    return derived;
  }
}

/**
 * Default compile function for signals.
 * Handles primitive types (string, number, boolean).
 */
function defaultCompile(value: any): PropertyValue {
  if (typeof value === 'string') {
    return { type: 'string', value };
  }
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { type: 'u32', value }
      : { type: 'f32', value };
  }
  if (typeof value === 'boolean') {
    return { type: 'u8', value: value ? 1 : 0 };
  }
  return { type: 'string', value: String(value) };
}
