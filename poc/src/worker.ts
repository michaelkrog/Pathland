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
  SemanticColorToken
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
      // In a Worker, self.postMessage is the correct method
      (self as unknown as { postMessage: (message: any, transfer: Transferable[]) => void }).postMessage(message, [message.buffer]);
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
}

// ============================================
// WORKER LIFECYCLE
// ============================================

const app = new PathlandApplication();

// Handle messages from the main thread
self.onmessage = function(event: MessageEvent) {
  if (event.data && event.data.type === 'ping') {
    // Ensure app is referenced
    void app;
    (self as any).postMessage({ type: 'pong' });
  }
};

// Export for testing
export { PathlandApplication };
