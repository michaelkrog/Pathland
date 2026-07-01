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
  createPropertyValue,
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
  ROOT_CONTAINER_ID,
  Opcode,
  EnvironmentField,
  FILL
} from './protocol/constants';
import { BinaryReader } from './protocol/binary';
import { PropertyValue } from './application/types';

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
   * Sets a design token value.
   */
  setDesignToken(tokenPath: string, value: any): void {
    this.commands.push({
      opcode: 'SET_DESIGN_TOKEN',
      tokenPath,
      value: createPropertyValue(value)
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
// ENVIRONMENT STATE
// ============================================

/**
 * Stores the current environment state received from the renderer.
 * In a full implementation, this would be used by the application to make UI decisions.
 */
let environmentState: Map<number, PropertyValue> = new Map();

/**
 * Handles an environment message from the renderer.
 */
function handleEnvironmentMessage(binaryData: ArrayBuffer): void {
  // Decode the environment message
  const buffer = new Uint8Array(binaryData);
  const reader = new BinaryReader(buffer);
  
  // Read the opcode
  const opcode = reader.readU8();
  
  switch (opcode) {
    case Opcode.SET_ENVIRONMENT:
      decodeEnvironmentMessage(reader);
      break;
    
    case Opcode.UPDATE_ENVIRONMENT:
      decodeEnvironmentMessage(reader);
      break;
    
    case Opcode.REQUEST_ENVIRONMENT:
      // This should not happen on the application side
      console.warn('[Pathland] Received REQUEST_ENVIRONMENT on application side - should be sent to renderer');
      break;
    
    default:
      console.warn(`[Pathland] Unknown environment opcode: ${opcode}`);
      break;
  }
}

/**
 * Decodes an environment message (SET_ENVIRONMENT or UPDATE_ENVIRONMENT).
 */
function decodeEnvironmentMessage(reader: BinaryReader): void {
  const fieldCount = reader.readU8();
  
  for (let i = 0; i < fieldCount; i++) {
    const fieldId = reader.readU8();
    const fieldSize = reader.readU8();
    const value = decodeEnvironmentFieldValue(reader, fieldId, fieldSize);
    
    // Store the environment field
    environmentState.set(fieldId, value);
    
    // Log for debugging
    const fieldName = getEnvironmentFieldName(fieldId);
    console.log(`[Pathland] Environment: ${fieldName} =`, value);
  }
}

/**
 * Decodes an environment field value based on its fieldId and size.
 */
function decodeEnvironmentFieldValue(reader: BinaryReader, fieldId: number, fieldSize: number): PropertyValue {
  // This mirrors the logic in the renderer's decoder
  switch (fieldId) {
    case EnvironmentField.VIEWPORT_WIDTH_PX:
    case EnvironmentField.VIEWPORT_HEIGHT_PX:
    case EnvironmentField.VIEWPORT_WIDTH_DP:
    case EnvironmentField.VIEWPORT_HEIGHT_DP:
    case EnvironmentField.SAFE_AREA_TOP:
    case EnvironmentField.SAFE_AREA_RIGHT:
    case EnvironmentField.SAFE_AREA_BOTTOM:
    case EnvironmentField.SAFE_AREA_LEFT:
      return { type: 'u32', value: reader.readU32() };
    
    case EnvironmentField.DEVICE_PIXEL_RATIO:
    case EnvironmentField.FONT_SCALE:
      return { type: 'f32', value: reader.readF32() };
    
    case EnvironmentField.COLOR_SCHEME:
    case EnvironmentField.TEXT_DIRECTION:
    case EnvironmentField.PLATFORM:
    case EnvironmentField.DEVICE_TYPE:
    case EnvironmentField.POINTER_TYPE:
    case EnvironmentField.ORIENTATION:
    case EnvironmentField.REDUCED_MOTION:
    case EnvironmentField.KEYBOARD_AVAILABLE:
      return { type: 'u8', value: reader.readU8() };
    
    case EnvironmentField.LOCALE:
    case EnvironmentField.TIMEZONE:
      return { type: 'string', value: reader.readString() };
    
    default:
      // For unknown fields, skip the bytes
      reader.skip(fieldSize);
      return { type: 'string', value: `unknown_${fieldId}` };
  }
}

/**
 * Gets the human-readable name of an environment field.
 */
function getEnvironmentFieldName(fieldId: number): string {
  const names: Record<number, string> = {
    [EnvironmentField.VIEWPORT_WIDTH_PX]: 'VIEWPORT_WIDTH_PX',
    [EnvironmentField.VIEWPORT_HEIGHT_PX]: 'VIEWPORT_HEIGHT_PX',
    [EnvironmentField.VIEWPORT_WIDTH_DP]: 'VIEWPORT_WIDTH_DP',
    [EnvironmentField.VIEWPORT_HEIGHT_DP]: 'VIEWPORT_HEIGHT_DP',
    [EnvironmentField.DEVICE_PIXEL_RATIO]: 'DEVICE_PIXEL_RATIO',
    [EnvironmentField.SAFE_AREA_TOP]: 'SAFE_AREA_TOP',
    [EnvironmentField.SAFE_AREA_RIGHT]: 'SAFE_AREA_RIGHT',
    [EnvironmentField.SAFE_AREA_BOTTOM]: 'SAFE_AREA_BOTTOM',
    [EnvironmentField.SAFE_AREA_LEFT]: 'SAFE_AREA_LEFT',
    [EnvironmentField.COLOR_SCHEME]: 'COLOR_SCHEME',
    [EnvironmentField.TEXT_DIRECTION]: 'TEXT_DIRECTION',
    [EnvironmentField.REDUCED_MOTION]: 'REDUCED_MOTION',
    [EnvironmentField.FONT_SCALE]: 'FONT_SCALE',
    [EnvironmentField.PLATFORM]: 'PLATFORM',
    [EnvironmentField.DEVICE_TYPE]: 'DEVICE_TYPE',
    [EnvironmentField.POINTER_TYPE]: 'POINTER_TYPE',
    [EnvironmentField.KEYBOARD_AVAILABLE]: 'KEYBOARD_AVAILABLE',
    [EnvironmentField.ORIENTATION]: 'ORIENTATION',
    [EnvironmentField.LOCALE]: 'LOCALE',
    [EnvironmentField.TIMEZONE]: 'TIMEZONE',
  };
  return names[fieldId] || `UNKNOWN_${fieldId}`;
}

/**
 * Gets the current value of an environment field.
 */
export function getEnvironmentValue(fieldId: number): PropertyValue | undefined {
  return environmentState.get(fieldId);
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
  envTextId = null;
  envVStackId = null;
  tokenDemoId = null;
  tokenValue = 0;
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
  
  // Handle design token demo clicks
  if (demoType === 'design-tokens' && eventType === EventType.CLICK && targetId === tokenDemoId) {
    handleTokenClick(targetId);
  }
}

function getCurrentTime(): string {
  const now = new Date();
  return now.toLocaleTimeString();
}

// ============================================
// DEMO 7: ENVIRONMENT CONTEXT
// ============================================

let envTextId: number | null = null;
let envVStackId: number | null = null;

function startDemo7(): void {
  // Demo 7: Environment Context - Display viewport info that updates on resize
  stopAllDemos();
  demoType = 'environment';
  
  app.reset();
  
  // Create a VStack to contain environment info
  envVStackId = app.createNode(ComponentType.VSTACK, {
    [StackProperty.SPACING]: 12,
    [StackProperty.ALIGNMENT]: Alignment.CENTER,
    [StackProperty.PADDING]: 20,
    [StyleProperty.BACKGROUND_COLOR]: { type: 'color', kind: 'literal', rgba: 0xFFf0f0f0 }, // Light gray background
    [StyleProperty.BORDER_RADIUS]: 8,
  });
  
  // Create title
  const titleId = app.createNode(ComponentType.TEXT, {
    [TextProperty.TEXT]: 'Environment Context Demo',
    [StyleProperty.FONT_SIZE]: 24,
    [StyleProperty.FONT_WEIGHT]: 0x06, // BOLD
    [StyleProperty.COLOR]: { type: 'color', kind: 'literal', rgba: 0xFF000000 }, // Black
    [TextProperty.TEXT_ALIGNMENT]: TextAlignment.CENTER,
  });
  
  // Create environment info text
  envTextId = app.createNode(ComponentType.TEXT, {
    [TextProperty.TEXT]: getEnvironmentText(),
    [StyleProperty.FONT_SIZE]: 16,
    [StyleProperty.COLOR]: { type: 'color', kind: 'literal', rgba: 0xFF333333 }, // Dark text
    [TextProperty.TEXT_ALIGNMENT]: TextAlignment.CENTER,
  });
  
  // Create instructions
  const instructionId = app.createNode(ComponentType.TEXT, {
    [TextProperty.TEXT]: 'Resize the window to see environment values update',
    [StyleProperty.FONT_SIZE]: 14,
    [StyleProperty.COLOR]: { type: 'color', kind: 'literal', rgba: 0xFF666666 },
    [TextProperty.TEXT_ALIGNMENT]: TextAlignment.CENTER,
  });
  
  // Build hierarchy
  app.insertIntoRoot(envVStackId);
  app.insertChild(envVStackId, titleId);
  app.insertChild(envVStackId, envTextId);
  app.insertChild(envVStackId, instructionId);
  
  app.sync();
  
  // Start an interval to update the environment display
  // (Environment updates come from the renderer, but we also poll to show we can read the values)
  activeInterval = setInterval(() => {
    updateEnvironmentDisplay();
  }, 1000);
}

function getEnvironmentText(): string {
  const width = getEnvironmentValue(0x01); // VIEWPORT_WIDTH_PX
  const height = getEnvironmentValue(0x02); // VIEWPORT_HEIGHT_PX
  const dpr = getEnvironmentValue(0x05); // DEVICE_PIXEL_RATIO
  const colorScheme = getEnvironmentValue(0x0A); // COLOR_SCHEME
  const platform = getEnvironmentValue(0x0E); // PLATFORM
  const deviceType = getEnvironmentValue(0x0F); // DEVICE_TYPE
  const orientation = getEnvironmentValue(0x12); // ORIENTATION
  const locale = getEnvironmentValue(0x13); // LOCALE
  
  const widthVal = width && width.type === 'u32' ? width.value : '?';
  const heightVal = height && height.type === 'u32' ? height.value : '?';
  const dprVal = dpr && dpr.type === 'f32' ? dpr.value.toFixed(2) : '?';
  const colorSchemeVal = colorScheme && colorScheme.type === 'u8' ? getColorSchemeName(colorScheme.value) : '?';
  const platformVal = platform && platform.type === 'u8' ? getPlatformName(platform.value) : '?';
  const deviceTypeVal = deviceType && deviceType.type === 'u8' ? getDeviceTypeName(deviceType.value) : '?';
  const orientationVal = orientation && orientation.type === 'u8' ? getOrientationName(orientation.value) : '?';
  const localeVal = locale && locale.type === 'string' ? locale.value : '?';
  
  return `Viewport: ${widthVal}×${heightVal}px\nDPR: ${dprVal}\nColor: ${colorSchemeVal}\nPlatform: ${platformVal}\nDevice: ${deviceTypeVal}\nOrientation: ${orientationVal}\nLocale: ${localeVal}`;
}

function getColorSchemeName(value: number): string {
  switch (value) {
    case 0: return 'Light';
    case 1: return 'Dark';
    case 2: return 'System';
    default: return `Unknown(${value})`;
  }
}

function getPlatformName(value: number): string {
  switch (value) {
    case 0: return 'iOS';
    case 1: return 'Android';
    case 2: return 'Web';
    case 3: return 'Windows';
    case 4: return 'macOS';
    case 5: return 'Linux';
    default: return `Unknown(${value})`;
  }
}

function getDeviceTypeName(value: number): string {
  switch (value) {
    case 0: return 'Phone';
    case 1: return 'Tablet';
    case 2: return 'Desktop';
    case 3: return 'Embedded';
    default: return `Unknown(${value})`;
  }
}

function getOrientationName(value: number): string {
  switch (value) {
    case 0: return 'Portrait';
    case 1: return 'Landscape';
    case 2: return 'Square';
    default: return `Unknown(${value})`;
  }
}

function updateEnvironmentDisplay(): void {
  if (!envTextId) return;
  
  const updateApp = new PathlandApplication();
  updateApp.setProperty(envTextId, TextProperty.TEXT, getEnvironmentText());
  const commands = updateApp.flushCommands();
  const encoded = encodeMessage(commands);
  (self as any).postMessage({
    type: 'commands',
    binary: encoded,
    commands: commands
  }, [encoded.buffer]);
}

// ============================================
// DEMO 8: DESIGN TOKENS
// ============================================

let tokenDemoId: number | null = null;
let tokenValue: number = 0;

function startDemo8(): void {
  // Demo 8: Design Tokens - Show how tokens can be used and updated
  stopAllDemos();
  demoType = 'design-tokens';
  
  app.reset();
  tokenValue = 0;
  
  // Create a VStack to contain the demo
  const vstackId = app.createNode(ComponentType.VSTACK, {
    [StackProperty.SPACING]: 16,
    [StackProperty.ALIGNMENT]: Alignment.CENTER,
    [StackProperty.PADDING]: 20,
    [StyleProperty.WIDTH]: FILL,
    [StyleProperty.HEIGHT]: FILL,
  });
  
  // Create title
  const titleId = app.createNode(ComponentType.TEXT, {
    [TextProperty.TEXT]: 'Design Token Demo',
    [StyleProperty.FONT_SIZE]: 24,
    [StyleProperty.FONT_WEIGHT]: 0x06, // BOLD
    [StyleProperty.COLOR]: { type: 'color', kind: 'semantic', tokenId: SemanticColorToken.PRIMARY_TEXT },
    [TextProperty.TEXT_ALIGNMENT]: TextAlignment.CENTER,
  });
  
  // Create a box that uses a design token for its background color
  const boxId = app.createNode(ComponentType.VSTACK, {
    [StackProperty.ALIGNMENT]: Alignment.CENTER,
    [StackProperty.JUSTIFICATION]: Justification.CENTER,
    [StyleProperty.BACKGROUND_COLOR]: { type: 'designToken', path: 'app.color.primary' },
    [StyleProperty.WIDTH]: 200,
    [StyleProperty.HEIGHT]: 100,
    [StyleProperty.BORDER_RADIUS]: 8,
    [StyleProperty.PADDING]: 20,
  });
  
  // Create text inside the box
  const boxTextId = app.createNode(ComponentType.TEXT, {
    [TextProperty.TEXT]: 'Click me to change token color',
    [StyleProperty.FONT_SIZE]: 16,
    [StyleProperty.FONT_WEIGHT]: 0x06,
    [StyleProperty.COLOR]: { type: 'color', kind: 'literal', rgba: 0xFFFFFFFF }, // White text
    [TextProperty.TEXT_ALIGNMENT]: TextAlignment.CENTER,
  });
  tokenDemoId = boxId;
  
  // Create token value display
  const tokenTextId = app.createNode(ComponentType.TEXT, {
    [TextProperty.TEXT]: `Token Value: ${tokenValue}`,
    [StyleProperty.FONT_SIZE]: 14,
    [StyleProperty.COLOR]: { type: 'color', kind: 'semantic', tokenId: SemanticColorToken.SECONDARY_TEXT },
    [TextProperty.TEXT_ALIGNMENT]: TextAlignment.CENTER,
  });
  
  // Create instructions
  const instructionId = app.createNode(ComponentType.TEXT, {
    [TextProperty.TEXT]: 'Click the colored box to cycle through token values',
    [StyleProperty.FONT_SIZE]: 14,
    [StyleProperty.COLOR]: { type: 'color', kind: 'semantic', tokenId: SemanticColorToken.TERTIARY_TEXT },
    [TextProperty.TEXT_ALIGNMENT]: TextAlignment.CENTER,
  });
  
  // Build hierarchy
  app.insertIntoRoot(vstackId);
  app.insertChild(vstackId, titleId);
  app.insertChild(vstackId, boxId);
  app.insertChild(boxId, boxTextId);
  app.insertChild(vstackId, tokenTextId);
  app.insertChild(vstackId, instructionId);
  
  // Register click handler on the box
  app.registerEventHandler(boxId, EventType.CLICK, 1);
  
  // Send design token command FIRST so it's available when UI is created
  app.setDesignToken('app.color.primary', { type: 'color', kind: 'literal', rgba: getTokenColor(tokenValue) });
  
  // Send all commands together
  app.sync();
}

function getTokenColor(index: number): number {
  const colors = [
    0xFFff0000, // Red
    0xFF00ff00, // Green
    0xFF0000ff, // Blue
    0xFFffff00, // Yellow
    0xFFff00ff, // Magenta
    0xFF00ffff, // Cyan
  ];
  return colors[index % colors.length];
}

function handleTokenClick(targetId: number): void {
  if (demoType !== 'design-tokens' || targetId !== tokenDemoId) return;
  
  // Cycle token value
  tokenValue = (tokenValue + 1) % 6;
  
  // Update the design token
  const tokenApp = new PathlandApplication();
  tokenApp.setDesignToken('app.color.primary', { type: 'color', kind: 'literal', rgba: getTokenColor(tokenValue) });
  
  // Also update the box's background color to trigger re-resolution of the design token
  // This is a workaround until we have a proper design token change notification system
  tokenApp.setProperty(tokenDemoId!, StyleProperty.BACKGROUND_COLOR, { type: 'designToken', path: 'app.color.primary' });
  
  const tokenCommands = tokenApp.flushCommands();
  const tokenEncoded = encodeMessage(tokenCommands);
  (self as any).postMessage({
    type: 'commands',
    binary: tokenEncoded,
    commands: tokenCommands
  }, [tokenEncoded.buffer]);
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
          case '7':
            startDemo7();
            break;
          case '8':
            startDemo8();
            break;
        }
        break;
      
      case 'event':
        handleEvent(message.targetId, message.eventType);
        break;
      
      case 'environment':
        handleEnvironmentMessage(message.binary);
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
          case '7':
          case 'environment':
          case '8':
          case 'design-tokens':
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
