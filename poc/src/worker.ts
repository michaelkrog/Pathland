/**
 * Pathland Worker
 * 
 * This is the application-side worker that manages the UI tree
 * and sends binary commands to the renderer in the main thread.
 */

import { 
  encodeMessage, 
  createCreateNodeCommand, 
  createSetPropertyCommand,
  createRegisterEventHandlerCommand,
  Command
} from './application/encoder';
import { 
  ComponentType, 
  StackProperty, 
  TextProperty, 
  StyleProperty,
  Alignment,
  Justification,
  TextAlignment,
  SemanticColorToken,
  EventType,
  ROOT_CONTAINER_ID
} from './protocol/constants';

// ============================================
// APPLICATION STATE
// ============================================

class PathlandApplication {
  private nextId: number = 1;
  private commands: Command[] = [];
  
  constructor() {}
  
  /**
   * Creates a new node with optional properties.
   */
  createNode(
    componentType: ComponentType, 
    properties: Record<number, any> = {}
  ): number {
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
   * Sends all accumulated commands to the renderer.
   */
  sync(): void {
    const commands = this.flushCommands();
    if (commands.length > 0) {
      const message = encodeMessage(commands);
      // Send both binary message and commands for inspection
      (self as unknown as { postMessage: (message: any, transfer: Transferable[]) => void }).postMessage({
        type: 'commands',
        binary: message,
        commands: commands
      }, [message.buffer]);
    }
  }
  
  // ============================================
  // CONVENIENCE METHODS
  // ============================================
  
  /**
   * Creates a VStack with optional properties.
   */
  createVStack(properties: {
    spacing?: number;
    alignment?: Alignment;
    justification?: Justification;
    padding?: number;
  } = {}): number {
    const props: Record<number, any> = {};
    if (properties.spacing !== undefined) {
      props[StackProperty.SPACING] = properties.spacing;
    }
    if (properties.alignment !== undefined) {
      props[StackProperty.ALIGNMENT] = properties.alignment;
    }
    if (properties.justification !== undefined) {
      props[StackProperty.JUSTIFICATION] = properties.justification;
    }
    if (properties.padding !== undefined) {
      props[StackProperty.PADDING] = properties.padding;
    }
    return this.createNode(ComponentType.VSTACK, props);
  }
  
  /**
   * Creates an HStack with optional properties.
   */
  createHStack(properties: {
    spacing?: number;
    alignment?: Alignment;
    justification?: Justification;
    padding?: number;
  } = {}): number {
    const props: Record<number, any> = {};
    if (properties.spacing !== undefined) {
      props[StackProperty.SPACING] = properties.spacing;
    }
    if (properties.alignment !== undefined) {
      props[StackProperty.ALIGNMENT] = properties.alignment;
    }
    if (properties.justification !== undefined) {
      props[StackProperty.JUSTIFICATION] = properties.justification;
    }
    if (properties.padding !== undefined) {
      props[StackProperty.PADDING] = properties.padding;
    }
    return this.createNode(ComponentType.HSTACK, props);
  }
  
  /**
   * Creates a Text node with optional properties.
   */
  createText(properties: {
    text: string;
    textAlignment?: TextAlignment;
    lineLimit?: number;
    color?: { kind: 'semantic'; tokenId: SemanticColorToken } | { kind: 'literal'; rgba: number };
    fontSize?: number;
    fontWeight?: number;
    fontFamily?: string;
  }): number {
    const props: Record<number, any> = {};
    props[TextProperty.TEXT] = properties.text;
    if (properties.textAlignment !== undefined) {
      props[TextProperty.TEXT_ALIGNMENT] = properties.textAlignment;
    }
    if (properties.lineLimit !== undefined) {
      props[TextProperty.LINE_LIMIT] = properties.lineLimit;
    }
    if (properties.color !== undefined) {
      props[StyleProperty.COLOR] = properties.color;
    }
    if (properties.fontSize !== undefined) {
      props[StyleProperty.FONT_SIZE] = properties.fontSize;
    }
    if (properties.fontWeight !== undefined) {
      props[StyleProperty.FONT_WEIGHT] = properties.fontWeight;
    }
    if (properties.fontFamily !== undefined) {
      props[StyleProperty.FONT_FAMILY] = properties.fontFamily;
    }
    return this.createNode(ComponentType.TEXT, props);
  }
  
  /**
   * Creates a Spacer node.
   */
  createSpacer(): number {
    return this.createNode(ComponentType.SPACER);
  }
  
  /**
   * Sets the text content of a Text node.
   */
  setText(nodeId: number, text: string): void {
    this.setProperty(nodeId, TextProperty.TEXT, text);
  }
  
  /**
   * Sets the background color of a node.
   */
  setBackgroundColor(nodeId: number, color: { kind: 'semantic'; tokenId: SemanticColorToken } | { kind: 'literal'; rgba: number }): void {
    this.setProperty(nodeId, StyleProperty.BACKGROUND_COLOR, color);
  }
  
  /**
   * Sets the opacity of a node.
   */
  setOpacity(nodeId: number, opacity: number): void {
    this.setProperty(nodeId, StyleProperty.OPACITY, opacity);
  }
  
  /**
   * Sets the visibility of a node.
   */
  setVisible(nodeId: number, visible: boolean): void {
    this.setProperty(nodeId, StyleProperty.VISIBLE, visible);
  }
  
  /**
   * Sets the width of a node.
   */
  setWidth(nodeId: number, width: number): void {
    this.setProperty(nodeId, StyleProperty.WIDTH, width);
  }
  
  /**
   * Sets the height of a node.
   */
  setHeight(nodeId: number, height: number): void {
    this.setProperty(nodeId, StyleProperty.HEIGHT, height);
  }
  
  /**
   * Sets the padding of a node.
   */
  setPadding(nodeId: number, padding: number): void {
    this.setProperty(nodeId, StyleProperty.PADDING, padding);
  }

  /**
   * Inserts a child into the root container.
   */
  insertIntoRoot(childId: number, index: number = 0xFFFFFFFF): void {
    this.insertChild(ROOT_CONTAINER_ID, childId, index);
  }

  /**
   * Registers an event handler on a node.
   */
  registerEventHandler(nodeId: number, eventType: EventType, handlerId: number = 1): void {
    const command = createRegisterEventHandlerCommand(nodeId, eventType, handlerId);
    this.commands.push(command);
  }

  /**
   * Gets the next available node ID.
   */
  getNextId(): number {
    return this.nextId;
  }

  /**
   * Resets the application state.
   */
  reset(): void {
    this.nextId = 1;
    this.commands = [];
  }
}

// ============================================
// WORKER STATE
// ============================================

const app = new PathlandApplication();

// Demo state variables
let demoType: string | null = null;
let activeInterval: ReturnType<typeof setInterval> | null = null;
let clockTextId: number | null = null;
let clockWasBold = false;
let counterTextId: number | null = null;
let counterValue = 0;
let counterIsRed = false;

// ============================================
// DEMO IMPLEMENTATIONS
// ============================================

function createDemo1(): void {
  // Demo 1: Simple VStack with Text
  app.reset();
  
  // Create VSTACK
  const vstackId = app.createNode(ComponentType.VSTACK, {
    [StackProperty.SPACING]: 20,
    [StackProperty.ALIGNMENT]: Alignment.CENTER,
  });
  
  // Create TEXT nodes
  const text1Id = app.createNode(ComponentType.TEXT, {
    [TextProperty.TEXT]: 'Hello',
    [StyleProperty.COLOR]: { type: 'color', kind: 'semantic', tokenId: SemanticColorToken.PRIMARY_TEXT },
    [StyleProperty.FONT_SIZE]: 24,
    [TextProperty.TEXT_ALIGNMENT]: TextAlignment.CENTER,
  });
  
  const text2Id = app.createNode(ComponentType.TEXT, {
    [TextProperty.TEXT]: 'World',
    [StyleProperty.COLOR]: { type: 'color', kind: 'semantic', tokenId: SemanticColorToken.SECONDARY_TEXT },
    [StyleProperty.FONT_SIZE]: 18,
    [TextProperty.TEXT_ALIGNMENT]: TextAlignment.CENTER,
  });
  
  // Insert VSTACK into root container
  app.insertIntoRoot(vstackId);
  
  // Insert children into VSTACK
  app.insertChild(vstackId, text1Id);
  app.insertChild(vstackId, text2Id);
  
  app.sync();
}

function createDemo2(): void {
  // Demo 2: HStack with Spacer
  app.reset();
  
  // Create HSTACK
  const hstackId = app.createNode(ComponentType.HSTACK, {
    [StackProperty.SPACING]: 16,
    [StackProperty.PADDING]: 10,
  });
  
  // Create TEXT nodes
  const text1Id = app.createNode(ComponentType.TEXT, {
    [TextProperty.TEXT]: 'Left',
    [StyleProperty.FONT_SIZE]: 16,
  });
  
  const spacerId = app.createNode(ComponentType.SPACER);
  
  const text2Id = app.createNode(ComponentType.TEXT, {
    [TextProperty.TEXT]: 'Right',
    [StyleProperty.FONT_SIZE]: 16,
  });
  
  // Insert HSTACK into root container
  app.insertIntoRoot(hstackId);
  
  // Insert children into HSTACK
  app.insertChild(hstackId, text1Id);
  app.insertChild(hstackId, spacerId);
  app.insertChild(hstackId, text2Id);
  
  app.sync();
}

function createDemo3(): void {
  // Demo 3: Nested Stacks
  app.reset();
  
  // Create VStack
  const vstackId = app.createNode(ComponentType.VSTACK, {
    [StackProperty.SPACING]: 16,
    [StackProperty.ALIGNMENT]: Alignment.CENTER,
    [StackProperty.PADDING]: 20
  });
  
  // Create HStack child
  const hstackId = app.createNode(ComponentType.HSTACK, {
    [StackProperty.SPACING]: 12,
    [StackProperty.JUSTIFICATION]: Justification.SPACE_BETWEEN
  });
  
  // Create Text nodes
  const text1Id = app.createNode(ComponentType.TEXT, {
    [TextProperty.TEXT]: 'Left',
    [StyleProperty.FONT_SIZE]: 14,
    [StyleProperty.COLOR]: { type: 'color', kind: 'semantic', tokenId: SemanticColorToken.PRIMARY_TEXT }
  });
  
  const text2Id = app.createNode(ComponentType.TEXT, {
    [TextProperty.TEXT]: 'Right',
    [StyleProperty.FONT_SIZE]: 14,
    [StyleProperty.COLOR]: { type: 'color', kind: 'semantic', tokenId: SemanticColorToken.SECONDARY_TEXT }
  });
  
  // Build hierarchy
  app.insertIntoRoot(vstackId);
  app.insertChild(vstackId, hstackId);
  app.insertChild(hstackId, text1Id);
  app.insertChild(hstackId, text2Id);
  
  app.sync();
}

function createDemo4(): void {
  // Demo 4: With Styling
  app.reset();
  
  // Create VStack with background and padding
  const vstackId = app.createNode(ComponentType.VSTACK, {
    [StackProperty.SPACING]: 20,
    [StyleProperty.BACKGROUND_COLOR]: { type: 'color', kind: 'literal', rgba: 0xFFF0F0F0 },
    [StyleProperty.PADDING]: 30,
    [StyleProperty.OPACITY]: 1.0,
    [StyleProperty.WIDTH]: -1 // FILL
  });
  
  // Create Text with various styles
  const textId = app.createNode(ComponentType.TEXT, {
    [TextProperty.TEXT]: 'Styled Text',
    [StyleProperty.FONT_SIZE]: 24,
    [StyleProperty.FONT_WEIGHT]: 0x06, // BOLD
    [StyleProperty.COLOR]: { type: 'color', kind: 'literal', rgba: 0xFF007AFF },
    [TextProperty.TEXT_ALIGNMENT]: TextAlignment.CENTER
  });
  
  app.insertIntoRoot(vstackId);
  app.insertChild(vstackId, textId);
  
  app.sync();
}

function startDemo5(): void {
  // Demo 5: Live Clock
  stopAllDemos();
  demoType = 'clock';
  
  app.reset();
  
  // Create Text node for the clock
  clockTextId = app.createNode(ComponentType.TEXT, {
    [TextProperty.TEXT]: getCurrentTime(),
    [StyleProperty.FONT_SIZE]: 32,
    [StyleProperty.FONT_WEIGHT]: 0x04, // REGULAR
    [TextProperty.TEXT_ALIGNMENT]: TextAlignment.CENTER
  });
  
  app.insertIntoRoot(clockTextId);
  app.sync();
  
  // Start the clock update interval
  activeInterval = setInterval(() => {
    const updateApp = new PathlandApplication();
    const now = new Date();
    const timeText = now.toLocaleTimeString();
    const seconds = now.getSeconds();
    
    // Update the text property
    updateApp.setProperty(clockTextId!, TextProperty.TEXT, timeText);
    
    // Make bold when seconds are 0, 10, 20, 30, 40, 50
    const isBold = [0, 10, 20, 30, 40, 50].includes(seconds);
    if (isBold !== clockWasBold) {
      updateApp.setProperty(clockTextId!, StyleProperty.FONT_WEIGHT, isBold ? 0x06 : 0x04); // BOLD or REGULAR
      clockWasBold = isBold;
    }
    
    // Send update commands
    const commands = updateApp.flushCommands();
    const encoded = encodeMessage(commands);
    (self as any).postMessage({
      type: 'commands',
      binary: encoded,
      commands: commands
    }, [encoded.buffer]);
  }, 1000);
}

function startDemo6(): void {
  // Demo 6: Event Handling
  stopAllDemos();
  demoType = 'counter';
  
  app.reset();
  counterValue = 0;
  counterIsRed = false;
  
  // Create a VStack to contain the counter
  const vstackId = app.createNode(ComponentType.VSTACK, {
    [StackProperty.SPACING]: 20,
    [StackProperty.ALIGNMENT]: Alignment.CENTER,
    [StyleProperty.PADDING]: 30,
  });
  
  // Create the counter text node
  counterTextId = app.createNode(ComponentType.TEXT, {
    [TextProperty.TEXT]: `Counter: ${counterValue}`,
    [StyleProperty.FONT_SIZE]: 32,
    [StyleProperty.FONT_WEIGHT]: 0x06, // BOLD
    [StyleProperty.COLOR]: { type: 'color', kind: 'literal', rgba: 0xFF007AFF }, // color: blue
    [TextProperty.TEXT_ALIGNMENT]: TextAlignment.CENTER
  });
  
  // Create an instruction text
  const instructionId = app.createNode(ComponentType.TEXT, {
    [TextProperty.TEXT]: 'Click the counter above to increment',
    [StyleProperty.FONT_SIZE]: 14,
    [StyleProperty.COLOR]: { type: 'color', kind: 'semantic', tokenId: SemanticColorToken.SECONDARY_TEXT },
    [TextProperty.TEXT_ALIGNMENT]: TextAlignment.CENTER
  });
  
  // Build hierarchy
  app.insertIntoRoot(vstackId);
  app.insertChild(vstackId, counterTextId);
  app.insertChild(vstackId, instructionId);
  
  // Register click event handler on the counter text
  app.registerEventHandler(counterTextId, EventType.CLICK, 1);
  
  app.sync();
}

function stopAllDemos(): void {
  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }
  demoType = null;
  clockTextId = null;
  clockWasBold = false;
  counterTextId = null;
  counterValue = 0;
  counterIsRed = false;
  app.reset();
}

function handleEvent(targetId: number, eventType: number): void {
  if (demoType === 'counter' && eventType === EventType.CLICK && targetId === counterTextId) {
    // Increment the counter
    counterValue++;
    
    // Create an update command to change the text
    const updateApp = new PathlandApplication();
    updateApp.setProperty(counterTextId!, TextProperty.TEXT, `Counter: ${counterValue}`);
    
    // Only set color when it actually changes (every 5 clicks)
    const shouldBeRed = counterValue % 5 === 0;
    if (shouldBeRed !== counterIsRed) {
      if (shouldBeRed) {
        updateApp.setProperty(counterTextId!, StyleProperty.COLOR, { type: 'color', kind: 'literal', rgba: 0xFFff3b30 }); // red
      } else {
        updateApp.setProperty(counterTextId!, StyleProperty.COLOR, { type: 'color', kind: 'literal', rgba: 0xFF007AFF }); // blue
      }
      counterIsRed = shouldBeRed;
    }
    
    // Send update commands
    const commands = updateApp.flushCommands();
    const encoded = encodeMessage(commands);
    (self as any).postMessage({
      type: 'commands',
      binary: encoded,
      commands: commands
    }, [encoded.buffer]);
  }
}

function getCurrentTime(): string {
  const now = new Date();
  return now.toLocaleTimeString();
}

// ============================================
// WORKER LIFECYCLE
// ============================================

// Handle messages from the main thread
self.onmessage = function(event: MessageEvent) {
  const message = event.data;
  
  if (message && message.type) {
    switch (message.type) {
      case 'ping':
        (self as any).postMessage({ type: 'pong' });
        break;
      
      case 'demo':
        switch (message.demo) {
          case '1':
            createDemo1();
            break;
          case '2':
            createDemo2();
            break;
          case '3':
            createDemo3();
            break;
          case '4':
            createDemo4();
            break;
          case '5':
            startDemo5();
            break;
          case '6':
            startDemo6();
            break;
        }
        break;
      
      case 'event':
        handleEvent(message.targetId, message.eventType);
        break;
      
      case 'clear':
        stopAllDemos();
        // Send clear command
        const clearApp = new PathlandApplication();
        clearApp.sync();
        break;
      
      case 'stop':
        switch (message.demo) {
          case '5':
          case 'clock':
            stopAllDemos();
            break;
        }
        break;
    }
  } else if (message instanceof Uint8Array) {
    // This is a binary message from the renderer (shouldn't happen in worker context)
    // For now, ignore
  }
};

// Export for testing
export { PathlandApplication };
