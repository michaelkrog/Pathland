import { BinaryWriter } from '../protocol/binary';
import {
  Opcode,
  ComponentType,
  ValueType
} from '../protocol/constants';
import { Command, PropertyValue } from './types';

export type { Command };

export function encodeMessage(commands: Command[]): Uint8Array {
  const writer = new BinaryWriter();

  // Write header: version (u16) + instructionCount (u32)
  writer.writeU16(1); // Protocol version
  writer.writeU32(commands.length);

  // Write each command
  for (const command of commands) {
    switch (command.opcode) {
      case 'CREATE_NODE':
        encodeCreateNode(writer, command);
        break;
      case 'DELETE_NODE':
        encodeDeleteNode(writer, command);
        break;
      case 'INSERT_CHILD':
        encodeInsertChild(writer, command);
        break;
      case 'REMOVE_CHILD':
        encodeRemoveChild(writer, command);
        break;
      case 'SET_PROPERTY':
        encodeSetProperty(writer, command);
        break;
      case 'SET_DESIGN_TOKEN':
        encodeSetDesignToken(writer, command);
        break;
      default:
        // Unknown opcode - should not happen
        console.error(`Unknown command opcode: ${(command as any).opcode}`);
        break;
    }
  }

  return writer.toArray();
}

function encodeCreateNode(writer: BinaryWriter, command: Extract<Command, { opcode: 'CREATE_NODE' }>): void {
  writer.writeU8(Opcode.CREATE_NODE);
  writer.writeU32(command.nodeId);
  writer.writeU16(command.componentType);

  // Write property count (max 255 properties per node)
  if (command.properties.size > 255) {
    throw new Error(`Too many properties (${command.properties.size}) for CREATE_NODE. Maximum is 255.`);
  }
  writer.writeU8(command.properties.size);

  // Write each property
  for (const [propertyId, value] of command.properties) {
    writer.writeU16(propertyId);
    encodePropertyValue(writer, value);
  }
}

function encodeDeleteNode(writer: BinaryWriter, command: Extract<Command, { opcode: 'DELETE_NODE' }>): void {
  writer.writeU8(Opcode.DELETE_NODE);
  writer.writeU32(command.nodeId);
}

function encodeInsertChild(writer: BinaryWriter, command: Extract<Command, { opcode: 'INSERT_CHILD' }>): void {
  writer.writeU8(Opcode.INSERT_CHILD);
  writer.writeU32(command.parentId);
  writer.writeU32(command.childId);
  writer.writeU32(command.index);
}

function encodeRemoveChild(writer: BinaryWriter, command: Extract<Command, { opcode: 'REMOVE_CHILD' }>): void {
  writer.writeU8(Opcode.REMOVE_CHILD);
  writer.writeU32(command.parentId);
  writer.writeU32(command.childId);
}

function encodeSetProperty(writer: BinaryWriter, command: Extract<Command, { opcode: 'SET_PROPERTY' }>): void {
  writer.writeU8(Opcode.SET_PROPERTY);
  writer.writeU32(command.nodeId);
  writer.writeU16(command.propertyId);
  encodePropertyValue(writer, command.value);
}

function encodeSetDesignToken(writer: BinaryWriter, command: Extract<Command, { opcode: 'SET_DESIGN_TOKEN' }>): void {
  writer.writeU8(Opcode.SET_DESIGN_TOKEN);
  // For now, use a simple token ID (in real implementation, this would be more complex)
  writer.writeU32(0); // placeholder token ID
  writer.writeString(command.tokenPath);
  encodePropertyValue(writer, command.value);
}

/**
 * Encodes a property value according to BINARY_PROTOCOL.md Value Type Definitions
 */
function encodePropertyValue(writer: BinaryWriter, value: PropertyValue): void {
  switch (value.type) {
    case 'u8':
      writer.writeU8(ValueType.U8);
      writer.writeU8(value.value);
      break;
    case 'u32':
      writer.writeU8(ValueType.U32);
      writer.writeU32(value.value);
      break;
    case 'i32':
      writer.writeU8(ValueType.I32);
      writer.writeI32(value.value);
      break;
    case 'f32':
      writer.writeU8(ValueType.F32);
      writer.writeF32(value.value);
      break;
    case 'string':
      writer.writeU8(ValueType.STRING);
      writer.writeString(value.value);
      break;
    case 'enum':
      writer.writeU8(ValueType.ENUM);
      writer.writeU8(value.value);
      break;
    case 'color':
      writer.writeU8(ValueType.COLOR);
      if (value.kind === 'semantic') {
        writer.writeU8(0x01); // SEMANTIC_TOKEN
        writer.writeU16(value.tokenId);
      } else {
        writer.writeU8(0x02); // LITERAL_SRGB
        writer.writeU32(value.rgba);
      }
      break;
    case 'designToken':
      writer.writeU8(ValueType.DESIGN_TOKEN);
      writer.writeString(value.path);
      break;
    default:
      throw new Error(`Unknown property value type: ${(value as any).type}`);
  }
}

/**
 * Helper to create a PropertyValue from a simple value
 */
export function createPropertyValue(value: any): PropertyValue {
  // If it's already a PropertyValue-like object, return it as-is
  if (value && typeof value === 'object' && value.type) {
    return value as PropertyValue;
  }
  
  if (typeof value === 'number') {
    // Check if it's an integer or float
    if (Number.isInteger(value)) {
      if (value >= 0 && value <= 255) {
        return { type: 'u8', value };
      } else if (value >= 0) {
        return { type: 'u32', value };
      } else {
        return { type: 'i32', value };
      }
    } else {
      return { type: 'f32', value };
    }
  } else if (typeof value === 'string') {
    return { type: 'string', value };
  } else if (typeof value === 'boolean') {
    return { type: 'u8', value: value ? 1 : 0 };
  } else if (value && typeof value.rgba === 'number') {
    return { type: 'color', kind: 'literal', rgba: value.rgba };
  } else if (value && typeof value.tokenId === 'number') {
    return { type: 'color', kind: 'semantic', tokenId: value.tokenId };
  } else if (value && typeof value.path === 'string') {
    return { type: 'designToken', path: value.path };
  }
  throw new Error(`Cannot create PropertyValue from: ${value}`);
}

/**
 * Creates a CREATE_NODE command with properties
 */
export function createCreateNodeCommand(
  nodeId: number,
  componentType: ComponentType,
  properties: Record<number, any> = {}
): Command {
  const propertyMap = new Map<number, PropertyValue>();
  for (const [key, value] of Object.entries(properties)) {
    propertyMap.set(parseInt(key), createPropertyValue(value));
  }
  return {
    opcode: 'CREATE_NODE',
    nodeId,
    componentType,
    properties: propertyMap
  };
}

/**
 * Creates a SET_PROPERTY command
 */
export function createSetPropertyCommand(
  nodeId: number,
  propertyId: number,
  value: any
): Command {
  return {
    opcode: 'SET_PROPERTY',
    nodeId,
    propertyId,
    value: createPropertyValue(value)
  };
}
