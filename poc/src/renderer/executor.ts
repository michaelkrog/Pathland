import { ComponentType, StackProperty, TextProperty, StyleProperty, Alignment, Justification, TextAlignment, SemanticColorToken } from '../protocol/constants';
import { Command, PropertyValue, RenderElement } from '../application/types';
import { propertyValueToJS } from './decoder';

/**
 * Command Executor
 * 
 * Statelessly executes commands and updates the rendered output.
 * The ONLY state maintained is the idToElement map for event routing.
 */
export class CommandExecutor {
  private idToElement: Map<number, RenderElement> = new Map();
  private elementToId: WeakMap<HTMLElement, number> = new WeakMap();
  private rootContainer: HTMLElement;
  private rootNodeIds: Set<number> = new Set();

  constructor(rootContainer: HTMLElement) {
    this.rootContainer = rootContainer;
  }

  /**
   * Executes a list of commands and updates the rendered output.
   * This is a PURE FUNCTION with respect to the command input.
   * The only side effect is DOM manipulation.
   */
  executeCommands(commands: Command[]): void {
    for (const command of commands) {
      this.executeCommand(command);
    }
    
    // After processing all commands, add any root nodes to the rootContainer
    // Root nodes are nodes that were created but never inserted as children
    for (const nodeId of this.rootNodeIds) {
      const renderElement = this.idToElement.get(nodeId);
      if (renderElement && !renderElement.element.parentNode) {
        this.rootContainer.appendChild(renderElement.element);
      }
    }
    this.rootNodeIds.clear();
  }

  /**
   * Executes a single command.
   */
  executeCommand(command: Command): void {
    switch (command.opcode) {
      case 'CREATE_NODE':
        this.executeCreateNode(command);
        break;
      case 'DELETE_NODE':
        this.executeDeleteNode(command);
        break;
      case 'INSERT_CHILD':
        this.executeInsertChild(command);
        break;
      case 'REMOVE_CHILD':
        this.executeRemoveChild(command);
        break;
      case 'SET_PROPERTY':
        this.executeSetProperty(command);
        break;
      case 'SET_DESIGN_TOKEN':
        // Not implemented in Phase 1
        break;
      default:
        console.warn(`Unknown command opcode: ${(command as any).opcode}`);
        break;
    }
  }

  private executeCreateNode(command: Extract<Command, { opcode: 'CREATE_NODE' }>): void {
    const element = this.createElement(command.componentType);
    
    // Apply initial properties
    for (const [propertyId, value] of command.properties) {
      this.applyProperty(element, propertyId, value);
    }

    // Store in maps for future reference
    const renderElement: RenderElement = {
      element,
      componentId: command.nodeId,
      children: []
    };
    this.idToElement.set(command.nodeId, renderElement);
    this.elementToId.set(element, command.nodeId);
    
    // Track this node as potentially a root node
    // It will be removed from this set if it gets inserted as a child
    this.rootNodeIds.add(command.nodeId);
  }

  private executeDeleteNode(command: Extract<Command, { opcode: 'DELETE_NODE' }>): void {
    const renderElement = this.idToElement.get(command.nodeId);
    if (renderElement) {
      // Remove from DOM
      if (renderElement.element.parentNode) {
        renderElement.element.parentNode.removeChild(renderElement.element);
      }
      
      // Clean up maps
      this.idToElement.delete(command.nodeId);
      this.elementToId.delete(renderElement.element);
      this.rootNodeIds.delete(command.nodeId);
      
      // Also clean up any children
      for (const childElement of renderElement.children) {
        const childId = this.elementToId.get(childElement);
        if (childId !== undefined) {
          this.idToElement.delete(childId);
          this.elementToId.delete(childElement);
          this.rootNodeIds.delete(childId);
        }
      }
    }
  }

  private executeInsertChild(command: Extract<Command, { opcode: 'INSERT_CHILD' }>): void {
    const parentRenderElement = this.idToElement.get(command.parentId);
    const childRenderElement = this.idToElement.get(command.childId);
    
    if (parentRenderElement && childRenderElement) {
      const parentElement = parentRenderElement.element;
      const childElement = childRenderElement.element;
      
      // Remove child from rootNodeIds since it's being inserted as a child
      this.rootNodeIds.delete(command.childId);
      
      // Handle index = UINT32_MAX (append)
      const index = command.index === 0xFFFFFFFF 
        ? parentElement.children.length 
        : command.index;
      
      // Insert at the specified index
      if (index <= parentElement.children.length) {
        if (index < parentElement.children.length) {
          parentElement.insertBefore(childElement, parentElement.children[index]);
        } else {
          parentElement.appendChild(childElement);
        }
      } else {
        console.warn(`Insert index ${index} out of bounds for parent ${command.parentId}`);
      }
      
      // Update parent's children list
      parentRenderElement.children.splice(index, 0, childElement);
    } else {
      console.warn(`INSERT_CHILD: parent ${command.parentId} or child ${command.childId} not found`);
    }
  }

  private executeRemoveChild(command: Extract<Command, { opcode: 'REMOVE_CHILD' }>): void {
    const parentRenderElement = this.idToElement.get(command.parentId);
    const childRenderElement = this.idToElement.get(command.childId);
    
    if (parentRenderElement && childRenderElement) {
      const parentElement = parentRenderElement.element;
      const childElement = childRenderElement.element;
      
      if (childElement.parentNode === parentElement) {
        parentElement.removeChild(childElement);
        
        // Update parent's children list
        const childIndex = parentRenderElement.children.indexOf(childElement);
        if (childIndex !== -1) {
          parentRenderElement.children.splice(childIndex, 1);
        }
      }
    } else {
      console.warn(`REMOVE_CHILD: parent ${command.parentId} or child ${command.childId} not found`);
    }
  }

  private executeSetProperty(command: Extract<Command, { opcode: 'SET_PROPERTY' }>): void {
    const renderElement = this.idToElement.get(command.nodeId);
    
    if (renderElement) {
      this.applyProperty(renderElement.element, command.propertyId, command.value);
    } else {
      console.warn(`SET_PROPERTY: node ${command.nodeId} not found`);
    }
  }

  /**
   * Creates an HTML element for the given component type.
   */
  private createElement(componentType: ComponentType): HTMLElement {
    const element = document.createElement('div');
    
    // Set class based on component type for styling
    switch (componentType) {
      case ComponentType.HSTACK:
        element.classList.add('pathland-hstack');
        break;
      case ComponentType.VSTACK:
        element.classList.add('pathland-vstack');
        break;
      case ComponentType.TEXT:
        element.classList.add('pathland-text');
        element.textContent = ''; // Will be set by TEXT property
        break;
      case ComponentType.SPACER:
        element.classList.add('pathland-spacer');
        element.style.flex = '1 1 auto';
        element.style.minWidth = '0';
        element.style.minHeight = '0';
        break;
      case ComponentType.BUTTON:
        element.classList.add('pathland-button');
        break;
      default:
        element.classList.add('pathland-unknown');
        break;
    }
    
    // Store component type as data attribute for debugging
    element.dataset.pathlandType = componentType.toString();
    
    return element;
  }

  /**
   * Applies a property to an element based on the property ID.
   * This is where the protocol's property IDs map to actual renderer behavior.
   */
  private applyProperty(element: HTMLElement, propertyId: number, value: PropertyValue): void {
    const jsValue = propertyValueToJS(value);
    
    // HSTACK/VSTACK properties (0x0001-0x0005)
    switch (propertyId) {
      case StackProperty.SPACING:
        element.style.gap = `${jsValue}px`;
        break;
      case StackProperty.ALIGNMENT:
        this.applyStackAlignment(element, jsValue);
        break;
      case StackProperty.JUSTIFICATION:
        this.applyStackJustification(element, jsValue);
        break;
      case StackProperty.PADDING:
        element.style.padding = `${jsValue}px`;
        break;
      case StackProperty.CONTENT_MARGINS:
        // Content margins are internal margins within the stack
        element.style.padding = `${jsValue}px`;
        break;
    }
    
    // TEXT properties (0x000A-0x000F)
    switch (propertyId) {
      case TextProperty.TEXT:
        element.textContent = jsValue;
        break;
      case TextProperty.TEXT_ALIGNMENT:
        this.applyTextAlignment(element, jsValue);
        break;
      case TextProperty.LINE_LIMIT:
        element.style.overflow = jsValue === 0 ? 'visible' : 'hidden';
        element.style.textOverflow = jsValue === 0 ? '' : 'ellipsis';
        element.style.whiteSpace = jsValue === 0 ? 'normal' : 'nowrap';
        break;
    }
    
    // Style properties (0x1000-0x10FF)
    switch (propertyId) {
      case StyleProperty.BACKGROUND_COLOR:
        this.applyBackgroundColor(element, value);
        break;
      case StyleProperty.BACKGROUND_OPACITY:
        element.style.backgroundColor = `rgba(var(--bg-rgb), ${jsValue})`;
        break;
      case StyleProperty.BORDER_WIDTH:
        element.style.borderWidth = `${jsValue}px`;
        break;
      case StyleProperty.BORDER_COLOR:
        this.applyBorderColor(element, value);
        break;
      case StyleProperty.BORDER_RADIUS:
        element.style.borderRadius = `${jsValue}px`;
        break;
      case StyleProperty.PADDING:
        element.style.padding = `${jsValue}px`;
        break;
      case StyleProperty.FONT_SIZE:
        element.style.fontSize = `${jsValue}px`;
        break;
      case StyleProperty.FONT_WEIGHT:
        this.applyFontWeight(element, jsValue);
        break;
      case StyleProperty.FONT_FAMILY:
        element.style.fontFamily = jsValue;
        break;
      case StyleProperty.COLOR:
        this.applyTextColor(element, value);
        break;
      case StyleProperty.WIDTH:
        this.applyWidth(element, jsValue);
        break;
      case StyleProperty.HEIGHT:
        this.applyHeight(element, jsValue);
        break;
      case StyleProperty.OPACITY:
        element.style.opacity = jsValue.toString();
        break;
      case StyleProperty.VISIBLE:
        element.style.display = jsValue ? '' : 'none';
        break;
      case StyleProperty.Z_INDEX:
        element.style.zIndex = jsValue.toString();
        break;
      case StyleProperty.CLIPSTO_BOUNDS:
        element.style.overflow = jsValue ? 'hidden' : 'visible';
        break;
    }
  }

  private applyStackAlignment(element: HTMLElement, alignment: number): void {
    switch (alignment) {
      case Alignment.START:
        element.style.alignItems = 'flex-start';
        break;
      case Alignment.CENTER:
        element.style.alignItems = 'center';
        break;
      case Alignment.END:
        element.style.alignItems = 'flex-end';
        break;
      case Alignment.STRETCH:
        element.style.alignItems = 'stretch';
        break;
    }
  }

  private applyStackJustification(element: HTMLElement, justification: number): void {
    switch (justification) {
      case Justification.START:
        element.style.justifyContent = 'flex-start';
        break;
      case Justification.CENTER:
        element.style.justifyContent = 'center';
        break;
      case Justification.END:
        element.style.justifyContent = 'flex-end';
        break;
      case Justification.SPACE_BETWEEN:
        element.style.justifyContent = 'space-between';
        break;
      case Justification.SPACE_AROUND:
        element.style.justifyContent = 'space-around';
        break;
      case Justification.SPACE_EVENLY:
        element.style.justifyContent = 'space-evenly';
        break;
    }
  }

  private applyTextAlignment(element: HTMLElement, alignment: number): void {
    switch (alignment) {
      case TextAlignment.LEADING:
        element.style.textAlign = 'left';
        break;
      case TextAlignment.CENTER:
        element.style.textAlign = 'center';
        break;
      case TextAlignment.TRAILING:
        element.style.textAlign = 'right';
        break;
    }
  }

  private applyBackgroundColor(element: HTMLElement, value: PropertyValue): void {
    if (value.type === 'color' && value.kind === 'literal') {
      const { a, r, g, b } = this.rgbaToObject(value.rgba);
      element.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
      element.style.setProperty('--bg-rgb', `${r}, ${g}, ${b}`);
    } else if (value.type === 'color' && value.kind === 'semantic') {
      // Apply semantic color based on token
      this.applySemanticColor(element, 'backgroundColor', value.tokenId);
    }
  }

  private applyBorderColor(element: HTMLElement, value: PropertyValue): void {
    if (value.type === 'color' && value.kind === 'literal') {
      const { a, r, g, b } = this.rgbaToObject(value.rgba);
      element.style.borderColor = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
    } else if (value.type === 'color' && value.kind === 'semantic') {
      this.applySemanticColor(element, 'borderColor', value.tokenId);
    }
  }

  private applyTextColor(element: HTMLElement, value: PropertyValue): void {
    if (value.type === 'color' && value.kind === 'literal') {
      const { a, r, g, b } = this.rgbaToObject(value.rgba);
      element.style.color = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
    } else if (value.type === 'color' && value.kind === 'semantic') {
      this.applySemanticColor(element, 'color', value.tokenId);
    }
  }

  private applySemanticColor(element: HTMLElement, cssProperty: string, tokenId: number): void {
    // Map semantic color tokens to CSS variables or actual colors
    // In a real implementation, this would use the renderer's theme
    const colorMap: Record<number, string> = {
      [SemanticColorToken.PRIMARY_TEXT]: 'rgba(0, 0, 0, 1)',
      [SemanticColorToken.SECONDARY_TEXT]: 'rgba(60, 60, 60, 1)',
      [SemanticColorToken.BACKGROUND]: 'rgba(255, 255, 255, 1)',
      [SemanticColorToken.ACCENT]: 'rgba(0, 122, 255, 1)',
      [SemanticColorToken.ERROR]: 'rgba(255, 59, 48, 1)',
    };
    
    const color = colorMap[tokenId] || 'rgba(0, 0, 0, 1)';
    element.style.setProperty(cssProperty, color);
  }

  private applyFontWeight(element: HTMLElement, weight: number): void {
    // Map enum values to CSS font-weight
    const weightMap: Record<number, string> = {
      0x00: '100', // ULTRA_LIGHT
      0x01: '200', // THIN
      0x02: '300', // LIGHT
      0x03: '400', // REGULAR
      0x04: '500', // MEDIUM
      0x05: '600', // SEMIBOLD
      0x06: '700', // BOLD
      0x07: '800', // HEAVY
      0x08: '900', // BLACK
    };
    element.style.fontWeight = weightMap[weight] || '400';
  }

  private applyWidth(element: HTMLElement, width: number): void {
    if (width === -1) {
      element.style.width = '100%';
    } else if (width === -2) {
      element.style.width = 'fit-content';
    } else {
      element.style.width = `${width}px`;
    }
  }

  private applyHeight(element: HTMLElement, height: number): void {
    if (height === -1) {
      element.style.height = '100%';
    } else if (height === -2) {
      element.style.height = 'fit-content';
    } else {
      element.style.height = `${height}px`;
    }
  }

  private rgbaToObject(rgba: number): { a: number, r: number, g: number, b: number } {
    return {
      a: (rgba >>> 24) & 0xFF,
      r: (rgba >>> 16) & 0xFF,
      g: (rgba >>> 8) & 0xFF,
      b: rgba & 0xFF,
    };
  }

  /**
   * Gets the element for a given component ID.
   * Used for event routing.
   */
  getElement(componentId: number): HTMLElement | null {
    const renderElement = this.idToElement.get(componentId);
    return renderElement ? renderElement.element : null;
  }

  /**
   * Gets the component ID for a given element.
   * Used for event routing.
   */
  getComponentId(element: HTMLElement): number | undefined {
    return this.elementToId.get(element);
  }

  /**
   * Resets the executor, clearing all state.
   * This is called when we want to start fresh.
   */
  reset(): void {
    // Remove all elements from DOM
    for (const renderElement of this.idToElement.values()) {
      if (renderElement.element.parentNode) {
        renderElement.element.parentNode.removeChild(renderElement.element);
      }
    }
    
    // Clear maps
    this.idToElement.clear();
    this.elementToId = new WeakMap();
  }
}
