import { BinaryReader } from '../protocol/binary';
import {
  Opcode,
  ValueType,
  EnvironmentField
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
    // Environment Context Protocol (0x20-0x22)
    case Opcode.SET_ENVIRONMENT:
      return decodeSetEnvironment(reader);
    case Opcode.UPDATE_ENVIRONMENT:
      return decodeUpdateEnvironment(reader);
    case Opcode.REQUEST_ENVIRONMENT:
      return decodeRequestEnvironment(reader);
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
  const eventType = reader.readU8();
  reader.readU32(); // timestamp
  reader.readU8(); // phase
  
  // For now, skip the event-specific data
  // In a full implementation, we would decode based on eventType
  return {
    opcode: 'DISPATCH_EVENT',
    targetId,
    eventType
  };
}

function decodeRegisterEventHandler(reader: BinaryReader): Command {
  const nodeId = reader.readU32();
  const eventType = reader.readU8();
  reader.readU8(); // handlerPhase
  const handlerId = reader.readU32();
  
  return {
    opcode: 'REGISTER_EVENT_HANDLER',
    nodeId,
    eventType,
    handlerId
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

// ===== Environment Context Protocol Decoding =====

function decodeSetEnvironment(reader: BinaryReader): Command {
  const fieldCount = reader.readU8();
  const fields = new Map<number, PropertyValue>();
  
  for (let i = 0; i < fieldCount; i++) {
    const fieldId = reader.readU8();
    const fieldSize = reader.readU8();
    const fieldValue = decodeEnvironmentFieldValue(reader, fieldId, fieldSize);
    fields.set(fieldId, fieldValue);
  }
  
  return {
    opcode: 'SET_ENVIRONMENT',
    fields
  };
}

function decodeUpdateEnvironment(reader: BinaryReader): Command {
  const fieldCount = reader.readU8();
  const fields = new Map<number, PropertyValue>();
  
  for (let i = 0; i < fieldCount; i++) {
    const fieldId = reader.readU8();
    const fieldSize = reader.readU8();
    const fieldValue = decodeEnvironmentFieldValue(reader, fieldId, fieldSize);
    fields.set(fieldId, fieldValue);
  }
  
  return {
    opcode: 'UPDATE_ENVIRONMENT',
    fields
  };
}

function decodeRequestEnvironment(reader: BinaryReader): Command {
  const requestId = reader.readU8();
  const fieldCountOrAll = reader.readU8();
  
  // 0xFF means "all fields"
  if (fieldCountOrAll === 0xFF) {
    return {
      opcode: 'REQUEST_ENVIRONMENT',
      requestId,
      fieldIds: [] // Empty array means "all fields"
    };
  }
  
  const fieldIds: number[] = [];
  for (let i = 0; i < fieldCountOrAll; i++) {
    fieldIds.push(reader.readU8());
  }
  
  return {
    opcode: 'REQUEST_ENVIRONMENT',
    requestId,
    fieldIds
  };
}

/**
 * Decodes an environment field value based on its fieldId and size.
 * Different fields have different types as per the spec.
 */
function decodeEnvironmentFieldValue(reader: BinaryReader, fieldId: number, fieldSize: number): PropertyValue {
  // Determine the type based on fieldId
  switch (fieldId) {
    // Viewport dimensions (u32)
    case EnvironmentField.VIEWPORT_WIDTH_PX:
    case EnvironmentField.VIEWPORT_HEIGHT_PX:
    case EnvironmentField.VIEWPORT_WIDTH_DP:
    case EnvironmentField.VIEWPORT_HEIGHT_DP:
    case EnvironmentField.SAFE_AREA_TOP:
    case EnvironmentField.SAFE_AREA_RIGHT:
    case EnvironmentField.SAFE_AREA_BOTTOM:
    case EnvironmentField.SAFE_AREA_LEFT:
      return { type: 'u32', value: reader.readU32() };
    
    // Device pixel ratio (f32)
    case EnvironmentField.DEVICE_PIXEL_RATIO:
    case EnvironmentField.FONT_SCALE:
      return { type: 'f32', value: reader.readF32() };
    
    // Enums (u8)
    case EnvironmentField.COLOR_SCHEME:
    case EnvironmentField.TEXT_DIRECTION:
    case EnvironmentField.PLATFORM:
    case EnvironmentField.DEVICE_TYPE:
    case EnvironmentField.POINTER_TYPE:
    case EnvironmentField.ORIENTATION:
      return { type: 'u8', value: reader.readU8() };
    
    // Booleans (u8, but 0 or 1)
    case EnvironmentField.REDUCED_MOTION:
    case EnvironmentField.KEYBOARD_AVAILABLE:
      return { type: 'u8', value: reader.readU8() };
    
    // Strings (variable length)
    case EnvironmentField.LOCALE:
    case EnvironmentField.TIMEZONE:
      return { type: 'string', value: reader.readString() };
    
    // Default: read as raw bytes
    default:
      // For unknown fields, read the raw bytes
      const rawBytes = reader.readBytes(fieldSize);
      // Convert to a number if possible
      if (fieldSize === 1) {
        return { type: 'u8', value: rawBytes[0] };
      } else if (fieldSize === 4) {
        // Could be u32 or f32 - default to u32
        const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
        return { type: 'u32', value: view.getUint32(0, true) };
      }
      return { type: 'string', value: `unknown_${fieldId}` };
  }
}
