import { CommandExecutor } from './executor';
import { decodeMessage } from './decoder';
import { createCreateNodeCommand, createSetPropertyCommand, Command } from '../application/encoder';
import { ComponentType, ROOT_CONTAINER_ID } from '../protocol/constants';

/**
 * HTML Renderer
 * 
 * A stateless renderer that receives binary commands and renders to HTML/CSS.
 * This is the Phase 1 POC implementation.
 */
export class HTMLRenderer {
  private executor: CommandExecutor;
  private rootContainer: HTMLElement;

  constructor(rootContainer: HTMLElement = document.body) {
    this.rootContainer = rootContainer;
    this.executor = new CommandExecutor(rootContainer);
    this.setupDefaultStyles();
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
  receiveMessage(data: ArrayBuffer): void {
    // Ensure rootContainer is referenced (stored for potential future use)
    void this.rootContainer;
    const buffer = new Uint8Array(data);
    const message = decodeMessage(buffer);
    
    // Execute commands
    this.executor.executeCommands(message.commands);
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
}

// ============================================
// Worker Interface
// ============================================

// The renderer runs in the main thread, while the application runs in a worker
// This is the Phase 1 setup where we test the protocol locally

// Create a global renderer instance
let renderer: HTMLRenderer | null = null;

/**
 * Initialize the renderer in the main thread.
 */
export function initRenderer(rootContainer?: HTMLElement): HTMLRenderer {
  if (!renderer) {
    renderer = new HTMLRenderer(rootContainer);
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
   * Gets all accumulated commands and clears the queue.
   */
  flushCommands(): Command[] {
    const commands = [...this.commands];
    this.commands = [];
    return commands;
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
