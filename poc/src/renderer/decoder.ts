import { BinaryReader } from '../protocol/binary';
import {
  Opcode,
  ValueType
} from '../protocol/constants';
import { Command, PropertyValue } from '../application/types';

export interface DecodedMessage {
  version: number;
  commands: Command[];
}

export function decodeMessage(buffer: Uint8Array): DecodedMessage {
  const reader = new BinaryReader(buffer);

  // Read header
  const version = reader.readU16();
  const instructionCount = reader.readU32();

  const commands: Command[] = [];

  for (let i = 0; i < instructionCount; i++) {
    const opcode = reader.readU8();
    const command = decodeCommand(reader, opcode);
    if (command) {
      commands.push(command);
    } else {
      console.warn(`Skipping unknown opcode: ${opcode} at position ${reader.position}`);
    }
  }

  return { version, commands };
}

function decodeCommand(reader: BinaryReader, opcode: number): Command | null {
  switch (opcode) {
    case Opcode.CREATE_NODE:
      return decodeCreateNode(reader);
    case Opcode.DELETE_NODE:
      return decodeDeleteNode(reader);
    case Opcode.INSERT_CHILD:
      return decodeInsertChild(reader);
    case Opcode.REMOVE_CHILD:
      return decodeRemoveChild(reader);
    case Opcode.SET_PROPERTY:
      return decodeSetProperty(reader);
    case Opcode.SET_DESIGN_TOKEN:
      return decodeSetDesignToken(reader);
    case Opcode.DISPATCH_EVENT:
      return decodeDispatchEvent(reader);
    case Opcode.REGISTER_EVENT_HANDLER:
      return decodeRegisterEventHandler(reader);
    default:
      // Unknown opcode - skip for forward compatibility
      return null;
  }
}

function decodeCreateNode(reader: BinaryReader): Command {
  const nodeId = reader.readU32();
  const componentType = reader.readU16();
  const propertyCount = reader.readU8();

  const properties = new Map<number, PropertyValue>();

  for (let i = 0; i < propertyCount; i++) {
    const propertyId = reader.readU16();
    const value = decodePropertyValue(reader);
    properties.set(propertyId, value);
  }

  return {
    opcode: 'CREATE_NODE',
    nodeId,
    componentType,
    properties
  };
}

function decodeDeleteNode(reader: BinaryReader): Command {
  const nodeId = reader.readU32();
  return {
    opcode: 'DELETE_NODE',
    nodeId
  };
}

function decodeInsertChild(reader: BinaryReader): Command {
  const parentId = reader.readU32();
  const childId = reader.readU32();
  const index = reader.readU32();
  return {
    opcode: 'INSERT_CHILD',
    parentId,
    childId,
    index
  };
}

function decodeRemoveChild(reader: BinaryReader): Command {
  const parentId = reader.readU32();
  const childId = reader.readU32();
  return {
    opcode: 'REMOVE_CHILD',
    parentId,
    childId
  };
}

function decodeSetProperty(reader: BinaryReader): Command {
  const nodeId = reader.readU32();
  const propertyId = reader.readU16();
  const value = decodePropertyValue(reader);
  return {
    opcode: 'SET_PROPERTY',
    nodeId,
    propertyId,
    value
  };
}

function decodeSetDesignToken(reader: BinaryReader): Command {
  // For now, simplified implementation
  reader.readU32(); // tokenId (placeholder, not used in current implementation)
  const tokenPath = reader.readString();
  const value = decodePropertyValue(reader);
  return {
    opcode: 'SET_DESIGN_TOKEN',
    tokenPath,
    value
  };
}

function decodeDispatchEvent(reader: BinaryReader): Command {
  const targetId = reader.readU32();
  reader.readU8(); // eventType (placeholder)
  reader.readU32(); // timestamp (placeholder)
  reader.readU8(); // phase (placeholder)
  
  // For now, skip the event-specific data
  // In a full implementation, we would decode based on eventType
  return {
    opcode: 'SET_PROPERTY', // Placeholder - actual event handling would be different
    nodeId: targetId,
    propertyId: 0,
    value: { type: 'u32', value: 0 }
  };
}

function decodeRegisterEventHandler(reader: BinaryReader): Command {
  const nodeId = reader.readU32();
  reader.readU8(); // eventType (placeholder)
  reader.readU8(); // handlerPhase (placeholder)
  const handlerId = reader.readU32();
  
  // For now, skip - not needed for Phase 1
  return {
    opcode: 'SET_PROPERTY', // Placeholder
    nodeId,
    propertyId: 0,
    value: { type: 'u32', value: handlerId }
  };
}

/**
 * Decodes a property value according to BINARY_PROTOCOL.md Value Type Definitions
 */
function decodePropertyValue(reader: BinaryReader): PropertyValue {
  const valueType = reader.readU8();

  switch (valueType) {
    case ValueType.U8:
      return { type: 'u8', value: reader.readU8() };
    case ValueType.U32:
      return { type: 'u32', value: reader.readU32() };
    case ValueType.I32:
      return { type: 'i32', value: reader.readI32() };
    case ValueType.F32:
      return { type: 'f32', value: reader.readF32() };
    case ValueType.STRING:
      return { type: 'string', value: reader.readString() };
    case ValueType.ENUM:
      return { type: 'enum', value: reader.readU8() };
    case ValueType.COLOR: {
      const colorKind = reader.readU8();
      if (colorKind === 0x01) { // SEMANTIC_TOKEN
        return { type: 'color', kind: 'semantic', tokenId: reader.readU16() };
      } else if (colorKind === 0x02) { // LITERAL_SRGB
        return { type: 'color', kind: 'literal', rgba: reader.readU32() };
      } else {
        throw new Error(`Unknown color kind: ${colorKind}`);
      }
    }
    case ValueType.DESIGN_TOKEN:
      return { type: 'designToken', path: reader.readString() };
    default:
      throw new Error(`Unknown value type: ${valueType}`);
  }
}

/**
 * Utility to convert PropertyValue to a simple JavaScript value
 */
export function propertyValueToJS(value: PropertyValue): any {
  switch (value.type) {
    case 'u8':
    case 'u32':
    case 'i32':
    case 'enum':
      return value.value;
    case 'f32':
      return value.value;
    case 'string':
      return value.value;
    case 'color':
      if (value.kind === 'literal') {
        return { type: 'color', rgba: value.rgba };
      } else {
        return { type: 'color', tokenId: value.tokenId };
      }
    case 'designToken':
      return { type: 'designToken', path: value.path };
    default:
      return null;
  }
}
