import { CommandExecutor } from './executor';
import { decodeMessage } from './decoder';
import { encodeMessage, createCreateNodeCommand, createSetPropertyCommand, createRegisterEventHandlerCommand, Command } from '../application/encoder';
import { ComponentType, ROOT_CONTAINER_ID, EventType, EnvironmentField, ColorScheme, Platform, DeviceType, PointerType, Orientation, TextDirection } from '../protocol/constants';
import { BinaryWriter } from '../protocol/binary';

export type { EventType };

/**
 * HTML Renderer
 * 
 * A stateless renderer that receives binary commands and renders to HTML/CSS.
 * This is the Phase 1 POC implementation.
 */
export class HTMLRenderer {
  private executor: CommandExecutor;
  private worker: Worker | null = null;

  constructor(rootContainer: HTMLElement = document.body) {
    this.executor = new CommandExecutor(rootContainer);
    this.setupDefaultStyles();
  }

  /**
   * Sets up a worker for application logic.
   */
  setWorker(worker: Worker): void {
    this.worker = worker;
    
    // Initialize environment support
    this.initializeEnvironment();
    
    // Handle messages from worker
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data;
      
      // Handle command messages (with binary data and metadata)
      if (data && typeof data === 'object' && data.type === 'commands') {
        this.receiveMessage(data.binary.buffer);
        // Here we could use data.commands for inspection if needed
      }
      // Handle binary messages directly (for backward compatibility)
      else if (data instanceof Uint8Array) {
        this.receiveMessage(data.buffer);
      }
      // Handle other message types (ping/pong, etc.)
      else if (data && typeof data === 'object' && data.type) {
        if (data.type === 'pong') {
          console.log('[Worker] Pong received');
        }
        // Handle environment requests from application
        else if (data.type === 'request_environment') {
          this.handleEnvironmentRequest(data);
        }
      }
    };
    
    // Set up event forwarding to worker
    this.executor.setOnEventCallback((event) => {
      if (this.worker) {
        this.worker.postMessage({ 
          type: 'event', 
          targetId: event.targetId, 
          eventType: event.eventType,
          data: event.data 
        });
      }
    });
  }

  /**
   * Sends a message to the worker to trigger a demo.
   */
  triggerDemo(demoNumber: string): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'demo', demo: demoNumber });
    }
  }

  /**
   * Sends a clear message to the worker.
   */
  triggerClear(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'clear' });
    }
    this.executor.reset();
  }

  /**
   * Sends a stop message to the worker.
   */
  triggerStop(demoType: string): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'stop', demo: demoType });
    }
  }

  /**
   * Sets a callback to be called when events are dispatched from the renderer.
   * This is used to send events back to the application (worker thread).
   */
  setOnEventCallback(callback: (event: { targetId: number; eventType: number; data?: any }) => void): void {
    this.executor.setOnEventCallback(callback);
  }

  /**
   * Sets up default CSS styles for Pathland components.
   */
  private setupDefaultStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .pathland-hstack {
        display: flex;
        flex-direction: row;
        box-sizing: border-box;
      }
      
      .pathland-vstack {
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
      }
      
      .pathland-text {
        display: inline;
        box-sizing: border-box;
        white-space: nowrap;
      }
      
      .pathland-spacer {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
      }
      
      .pathland-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        cursor: pointer;
      }
      
      /* Default token colors */
      :root {
        --color-primary-text: rgba(0, 0, 0, 1);
        --color-secondary-text: rgba(60, 60, 60, 1);
        --color-background: rgba(255, 255, 255, 1);
        --color-accent: rgba(0, 122, 255, 1);
        --color-error: rgba(255, 59, 48, 1);
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Receives and processes a binary message from the application.
   */
  receiveMessage(data: ArrayBuffer | ArrayBufferLike): void {
    const buffer = new Uint8Array(data instanceof ArrayBuffer ? data : new ArrayBuffer(data.byteLength));
    
    // Time parsing
    const parseStart = performance.now();
    const message = decodeMessage(buffer);
    const parseEnd = performance.now();
    const parseTime = parseEnd - parseStart;
    
    // Time rendering
    const renderStart = performance.now();
    this.executor.executeCommands(message.commands);
    const renderEnd = performance.now();
    const renderTime = renderEnd - renderStart;
    
    // Log timing
    console.log(`[Pathland] Parsed ${message.commands.length} commands in ${parseTime.toFixed(2)}ms`);
    console.log(`[Pathland] Rendered ${message.commands.length} commands in ${renderTime.toFixed(2)}ms`);
  }

  /**
   * Resets the renderer, clearing all rendered content.
   */
  reset(): void {
    this.executor.reset();
  }

  /**
   * Gets the element for a given component ID.
   */
  getElement(componentId: number): HTMLElement | null {
    return this.executor.getElement(componentId);
  }

  /**
   * Gets the component ID for a given element.
   */
  getComponentId(element: HTMLElement): number | undefined {
    return this.executor.getComponentId(element);
  }

  // ============================================
  // ENVIRONMENT CONTEXT PROTOCOL
  // ============================================

  /**
   * Sends the current environment state to the application (worker).
   * Called at initialization and when environment changes.
   */
  sendEnvironmentToApplication(useUpdate: boolean = false): void {
    if (!this.worker) {
      console.warn('[Pathland] No worker to send environment to');
      return;
    }

    const writer = new BinaryWriter();
    const opcode = useUpdate ? 0x21 : 0x20; // UPDATE_ENVIRONMENT or SET_ENVIRONMENT
    const fields = this.collectEnvironmentFields();

    writer.writeU8(opcode);
    writer.writeU8(fields.size);

    for (const [fieldId, value] of fields) {
      writer.writeU8(fieldId);
      
      // Calculate the actual size by encoding to a temporary writer
      const sizeWriter = new BinaryWriter();
      this.encodeFieldValue(sizeWriter, fieldId, value);
      const fieldSize = sizeWriter.length;
      
      writer.writeU8(fieldSize);
      
      // Now write the actual value
      this.encodeFieldValue(writer, fieldId, value);
    }

    const message = writer.toArray();
    this.worker.postMessage({ type: 'environment', binary: message.buffer }, [message.buffer]);
  }

  /**
   * Collects the current environment fields.
   */
  private collectEnvironmentFields(): Map<number, any> {
    const fields = new Map<number, any>();

    // Viewport dimensions
    fields.set(EnvironmentField.VIEWPORT_WIDTH_PX, window.innerWidth);
    fields.set(EnvironmentField.VIEWPORT_HEIGHT_PX, window.innerHeight);
    
    // Calculate DP (logical) dimensions
    const dpr = window.devicePixelRatio || 1;
    fields.set(EnvironmentField.VIEWPORT_WIDTH_DP, Math.round(window.innerWidth * dpr));
    fields.set(EnvironmentField.VIEWPORT_HEIGHT_DP, Math.round(window.innerHeight * dpr));
    
    // Device pixel ratio
    fields.set(EnvironmentField.DEVICE_PIXEL_RATIO, dpr);

    // Safe area insets (for mobile - default to 0 for desktop)
    // In a real implementation, these would come from the platform
    fields.set(EnvironmentField.SAFE_AREA_TOP, 0);
    fields.set(EnvironmentField.SAFE_AREA_RIGHT, 0);
    fields.set(EnvironmentField.SAFE_AREA_BOTTOM, 0);
    fields.set(EnvironmentField.SAFE_AREA_LEFT, 0);

    // Color scheme
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    let colorScheme = ColorScheme.SYSTEM;
    if (prefersDark) {
      colorScheme = ColorScheme.DARK;
    } else if (prefersLight) {
      colorScheme = ColorScheme.LIGHT;
    }
    fields.set(EnvironmentField.COLOR_SCHEME, colorScheme);

    // Text direction
    fields.set(EnvironmentField.TEXT_DIRECTION, TextDirection.LTR); // Default

    // Reduced motion
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    fields.set(EnvironmentField.REDUCED_MOTION, reducedMotion ? 1 : 0);

    // Font scale
    fields.set(EnvironmentField.FONT_SCALE, 1.0); // Default

    // Platform (web in browser)
    fields.set(EnvironmentField.PLATFORM, Platform.WEB);

    // Device type (detect based on screen size)
    const isMobile = window.innerWidth <= 768 || window.innerHeight <= 768;
    fields.set(EnvironmentField.DEVICE_TYPE, isMobile ? DeviceType.PHONE : DeviceType.DESKTOP);

    // Pointer type (detect touch support)
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    fields.set(EnvironmentField.POINTER_TYPE, hasTouch ? PointerType.TOUCH : PointerType.MOUSE);

    // Keyboard availability
    fields.set(EnvironmentField.KEYBOARD_AVAILABLE, 1); // Assume available in desktop

    // Orientation
    const isPortrait = window.innerHeight > window.innerWidth;
    const isLandscape = window.innerWidth > window.innerHeight;
    let orientation = Orientation.SQUARE;
    if (isPortrait) {
      orientation = Orientation.PORTRAIT;
    } else if (isLandscape) {
      orientation = Orientation.LANDSCAPE;
    }
    fields.set(EnvironmentField.ORIENTATION, orientation);

    // Locale
    fields.set(EnvironmentField.LOCALE, navigator.language || 'en-US');

    // Timezone
    fields.set(EnvironmentField.TIMEZONE, Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

    return fields;
  }

  /**
   * Encodes a field value to the writer based on its ID.
   */
  private encodeFieldValue(writer: BinaryWriter, fieldId: number, value: any): void {
    switch (fieldId) {
      case EnvironmentField.VIEWPORT_WIDTH_PX:
      case EnvironmentField.VIEWPORT_HEIGHT_PX:
      case EnvironmentField.VIEWPORT_WIDTH_DP:
      case EnvironmentField.VIEWPORT_HEIGHT_DP:
      case EnvironmentField.SAFE_AREA_TOP:
      case EnvironmentField.SAFE_AREA_RIGHT:
      case EnvironmentField.SAFE_AREA_BOTTOM:
      case EnvironmentField.SAFE_AREA_LEFT:
        writer.writeU32(value);
        break;
      
      case EnvironmentField.DEVICE_PIXEL_RATIO:
      case EnvironmentField.FONT_SCALE:
        writer.writeF32(value);
        break;
      
      case EnvironmentField.COLOR_SCHEME:
      case EnvironmentField.TEXT_DIRECTION:
      case EnvironmentField.PLATFORM:
      case EnvironmentField.DEVICE_TYPE:
      case EnvironmentField.POINTER_TYPE:
      case EnvironmentField.ORIENTATION:
      case EnvironmentField.REDUCED_MOTION:
      case EnvironmentField.KEYBOARD_AVAILABLE:
        writer.writeU8(value);
        break;
      
      case EnvironmentField.LOCALE:
      case EnvironmentField.TIMEZONE:
        writer.writeString(value);
        break;
      
      default:
        // For unknown fields, write as u32 if it's a number
        if (typeof value === 'number') {
          if (Number.isInteger(value)) {
            writer.writeU32(value);
          } else {
            writer.writeF32(value);
          }
        } else {
          writer.writeString(String(value));
        }
    }
  }

  /**
   * Handles an environment request from the application.
   */
  private handleEnvironmentRequest(data: any): void {
    if (data.requestId !== undefined) {
      // This is a REQUEST_ENVIRONMENT message
      // For now, send full environment as SET_ENVIRONMENT
      // In a full implementation, we would only send requested fields
      this.sendEnvironmentToApplication(false); // Send full environment as SET_ENVIRONMENT
    }
  }

  /**
   * Sets up event listeners for environment changes.
   */
  private setupEnvironmentListeners(): void {
    // Listen for resize events
    window.addEventListener('resize', () => {
      this.sendEnvironmentToApplication(true); // Send UPDATE_ENVIRONMENT on resize
    });

    // Listen for color scheme changes
    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    colorSchemeQuery.addEventListener('change', () => {
      this.sendEnvironmentToApplication(true); // Send UPDATE_ENVIRONMENT on color scheme change
    });

    // Listen for reduced motion changes
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionQuery.addEventListener('change', () => {
      this.sendEnvironmentToApplication(true); // Send UPDATE_ENVIRONMENT on reduced motion change
    });

    // Listen for orientation changes
    window.addEventListener('orientationchange', () => {
      this.sendEnvironmentToApplication(true); // Send UPDATE_ENVIRONMENT on orientation change
    });
  }

  /**
   * Initializes the renderer with environment support.
   */
  initializeEnvironment(): void {
    // Send initial environment state to application
    this.sendEnvironmentToApplication(false); // Send SET_ENVIRONMENT at initialization
    
    // Set up listeners for environment changes
    this.setupEnvironmentListeners();
  }
}

// ============================================
// Worker Interface
// ============================================

// The renderer runs in the main thread, while the application runs in a worker
// This is the proper Pathland architecture

// Create a global renderer instance
let renderer: HTMLRenderer | null = null;
let worker: Worker | null = null;

/**
 * Initialize the renderer and worker in the main thread.
 */
export function initRenderer(rootContainer?: HTMLElement): HTMLRenderer {
  if (!renderer) {
    renderer = new HTMLRenderer(rootContainer);
    
    // Create and configure worker
    try {
      worker = new Worker(new URL('../worker.ts', import.meta.url), { type: 'module' });
      renderer.setWorker(worker);
      console.log('[Pathland] Worker initialized');
    } catch (error) {
      console.error('[Pathland] Failed to create worker:', error);
    }
  }
  return renderer;
}

/**
 * Get the global renderer instance.
 */
export function getRenderer(): HTMLRenderer | null {
  return renderer;
}

/**
 * Get the global worker instance.
 */
export function getWorker(): Worker | null {
  return worker;
}

/**
 * Handle messages from the worker (application).
 */
export function handleWorkerMessage(event: MessageEvent): void {
  if (event.data instanceof ArrayBuffer) {
    if (renderer) {
      renderer.receiveMessage(event.data);
    } else {
      console.error('Renderer not initialized. Call initRenderer() first.');
    }
  }
}

// ============================================
// Application Interface (for testing in main thread)
// ============================================

/**
 * Simple application that can generate commands directly.
 * Useful for testing without a worker.
 */
export class SimpleApplication {
  private nextId: number = 1;
  private commands: Command[] = [];

  constructor() {}

  /**
   * Creates a new node with optional properties.
   */
  createNode(componentType: ComponentType, properties: Record<number, any> = {}): number {
    const nodeId = this.nextId++;
    const command = createCreateNodeCommand(nodeId, componentType, properties);
    this.commands.push(command);
    return nodeId;
  }

  /**
   * Sets a property on an existing node.
   */
  setProperty(nodeId: number, propertyId: number, value: any): void {
    const command = createSetPropertyCommand(nodeId, propertyId, value);
    this.commands.push(command);
  }

  /**
   * Inserts a child into a parent at a specific index.
   * Use ROOT_CONTAINER_ID (0) as parentId to insert into the root container.
   */
  insertChild(parentId: number, childId: number, index: number = 0xFFFFFFFF): void {
    this.commands.push({
      opcode: 'INSERT_CHILD',
      parentId,
      childId,
      index
    });
  }
  
  /**
   * Inserts a child into the root container.
   */
  insertIntoRoot(childId: number, index: number = 0xFFFFFFFF): void {
    this.insertChild(ROOT_CONTAINER_ID, childId, index);
  }

  /**
   * Deletes a node.
   */
  deleteNode(nodeId: number): void {
    this.commands.push({
      opcode: 'DELETE_NODE',
      nodeId
    });
  }

  /**
   * Registers an event handler on a node.
   */
  registerEventHandler(nodeId: number, eventType: EventType, handlerId: number = 1): void {
    const command = createRegisterEventHandlerCommand(nodeId, eventType, handlerId);
    this.commands.push(command);
  }

  /**
   * Gets all accumulated commands and clears the queue.
   */
  flushCommands(): Command[] {
    const commands = [...this.commands];
    this.commands = [];
    return commands;
  }
  
  /**
   * Creates commands, encodes them, sends to renderer, and logs timing.
   * Helper for demo purposes.
   */
  syncAndLog(renderer: HTMLRenderer): void {
    const commands = this.flushCommands();
    if (commands.length === 0) return;
    
    // Time encoding
    const encodeStart = performance.now();
    const encoded = encodeMessage(commands);
    const encodeEnd = performance.now();
    const encodeTime = encodeEnd - encodeStart;
    
    // Time parsing and rendering
    const parseRenderStart = performance.now();
    renderer.receiveMessage(encoded.buffer);
    const parseRenderEnd = performance.now();
    const parseRenderTime = parseRenderEnd - parseRenderStart;
    
    // Log timing
    console.log(`[Pathland] Built ${commands.length} commands in ${encodeTime.toFixed(2)}ms`);
    console.log(`[Pathland] Parsed and rendered in ${parseRenderTime.toFixed(2)}ms`);
  }

  /**
   * Creates a simple VStack with TEXT children.
   */
  createSimpleUI(): Command[] {
    this.commands = [];
    
    // Create VSTACK
    const vstackId = this.createNode(ComponentType.VSTACK, {
      [0x0001]: 20, // spacing
      [0x0002]: 0x01, // alignment: CENTER
    });
    
    // Create TEXT nodes
    const text1Id = this.createNode(ComponentType.TEXT, {
      [0x000A]: 'Hello', // text
      [0x100A]: { type: 'color', kind: 'semantic', tokenId: 0x0001 }, // color: PRIMARY_TEXT
      [0x1007]: 24, // fontSize
      [0x000C]: 0x01, // textAlignment: CENTER
    });
    
    const text2Id = this.createNode(ComponentType.TEXT, {
      [0x000A]: 'World',
      [0x100A]: { type: 'color', kind: 'semantic', tokenId: 0x0002 }, // color: SECONDARY_TEXT
      [0x1007]: 18,
      [0x000C]: 0x01,
    });
    
    // Insert VSTACK into root container
    this.insertIntoRoot(vstackId);
    
    // Insert children into VSTACK
    this.insertChild(vstackId, text1Id);
    this.insertChild(vstackId, text2Id);
    
    return this.flushCommands();
  }

  /**
   * Creates an HSTACK with TEXT and SPACER.
   */
  createHStackWithSpacer(): Command[] {
    this.commands = [];
    
    // Create HSTACK
    const hstackId = this.createNode(ComponentType.HSTACK, {
      [0x0001]: 16, // spacing
      [0x0004]: 10, // padding
    });
    
    // Create TEXT nodes
    const text1Id = this.createNode(ComponentType.TEXT, {
      [0x000A]: 'Left',
      [0x1007]: 16,
    });
    
    const spacerId = this.createNode(ComponentType.SPACER);
    
    const text2Id = this.createNode(ComponentType.TEXT, {
      [0x000A]: 'Right',
      [0x1007]: 16,
    });
    
    // Insert HSTACK into root container
    this.insertIntoRoot(hstackId);
    
    // Insert children into HSTACK
    this.insertChild(hstackId, text1Id);
    this.insertChild(hstackId, spacerId);
    this.insertChild(hstackId, text2Id);
    
    return this.flushCommands();
  }
}
