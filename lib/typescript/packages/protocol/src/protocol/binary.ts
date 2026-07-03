/**
 * Pathland Binary Encoding/Decoding
 */

import { LITTLE_ENDIAN, Opcode } from './constants';
import type { Command, PropertyValue, DecodedMessage } from './types';

// ============================================
// BINARY WRITER
// ============================================

export class BinaryWriter {
  private buffer: Uint8Array;
  private view: DataView;
  private cursor: number;

  constructor(initialSize: number = 256) {
    this.buffer = new Uint8Array(initialSize);
    this.view = new DataView(this.buffer.buffer);
    this.cursor = 0;
  }

  writeU8(value: number): void {
    this.ensureCapacity(1);
    this.buffer[this.cursor++] = value & 0xFF;
  }

  writeU16(value: number): void {
    this.ensureCapacity(2);
    this.view.setUint16(this.cursor, value & 0xFFFF, LITTLE_ENDIAN);
    this.cursor += 2;
  }

  writeU32(value: number): void {
    this.ensureCapacity(4);
    this.view.setUint32(this.cursor, value >>> 0, LITTLE_ENDIAN);
    this.cursor += 4;
  }

  writeI32(value: number): void {
    this.ensureCapacity(4);
    this.view.setInt32(this.cursor, value, LITTLE_ENDIAN);
    this.cursor += 4;
  }

  writeF32(value: number): void {
    this.ensureCapacity(4);
    this.view.setFloat32(this.cursor, value, LITTLE_ENDIAN);
    this.cursor += 4;
  }

  writeString(value: string): void {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);
    this.writeU32(bytes.length);
    this.ensureCapacity(bytes.length);
    this.buffer.set(bytes, this.cursor);
    this.cursor += bytes.length;
  }

  writeBytes(bytes: Uint8Array): void {
    this.ensureCapacity(bytes.length);
    this.buffer.set(bytes, this.cursor);
    this.cursor += bytes.length;
  }

  private ensureCapacity(additional: number): void {
    if (this.cursor + additional > this.buffer.length) {
      const newSize = Math.max(this.buffer.length * 2, this.cursor + additional);
      const newBuffer = new Uint8Array(newSize);
      newBuffer.set(this.buffer.subarray(0, this.cursor));
      this.buffer = newBuffer;
      this.view = new DataView(this.buffer.buffer);
    }
  }

  get position(): number {
    return this.cursor;
  }

  toArray(): Uint8Array {
    return this.buffer.subarray(0, this.cursor);
  }

  get length(): number {
    return this.cursor;
  }

  reset(): void {
    this.cursor = 0;
  }
}

// ============================================
// BINARY READER
// ============================================

export class BinaryReader {
  private buffer: Uint8Array;
  private view: DataView;
  private cursor: number;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    this.cursor = 0;
  }

  readU8(): number {
    return this.buffer[this.cursor++];
  }

  readU16(): number {
    const value = this.view.getUint16(this.cursor, LITTLE_ENDIAN);
    this.cursor += 2;
    return value;
  }

  readU32(): number {
    const value = this.view.getUint32(this.cursor, LITTLE_ENDIAN);
    this.cursor += 4;
    return value;
  }

  readI32(): number {
    const value = this.view.getInt32(this.cursor, LITTLE_ENDIAN);
    this.cursor += 4;
    return value;
  }

  readF32(): number {
    const value = this.view.getFloat32(this.cursor, LITTLE_ENDIAN);
    this.cursor += 4;
    return value;
  }

  readString(): string {
    const length = this.readU32();
    const decoder = new TextDecoder();
    const value = decoder.decode(this.buffer.subarray(this.cursor, this.cursor + length));
    this.cursor += length;
    return value;
  }

  readBytes(length: number): Uint8Array {
    const value = this.buffer.subarray(this.cursor, this.cursor + length);
    this.cursor += length;
    return value;
  }

  skip(bytes: number): void {
    this.cursor += bytes;
  }

  get remaining(): number {
    return this.buffer.length - this.cursor;
  }

  get position(): number {
    return this.cursor;
  }
}

// ============================================
// ENCODING
// ============================================

export function encodeMessage(commands: Command[]): Uint8Array {
  const writer = new BinaryWriter();
  writer.writeU16(1);
  writer.writeU32(commands.length);
  for (const command of commands) {
    encodeCommand(writer, command);
  }
  return writer.toArray();
}

function encodeCommand(writer: BinaryWriter, command: Command): void {
  switch (command.opcode) {
    case 'CREATE_NODE':
      writer.writeU8(Opcode.CREATE_NODE);
      writer.writeU32(command.nodeId);
      writer.writeU16(command.componentType);
      if (command.properties.size > 255) {
        throw new Error(`Too many properties for CREATE_NODE. Max 255, got ${command.properties.size}`);
      }
      writer.writeU8(command.properties.size);
      for (const [id, value] of command.properties) {
        writer.writeU16(id);
        encodePropertyValue(writer, value);
      }
      break;
    case 'DELETE_NODE':
      writer.writeU8(Opcode.DELETE_NODE);
      writer.writeU32(command.nodeId);
      break;
    case 'INSERT_CHILD':
      writer.writeU8(Opcode.INSERT_CHILD);
      writer.writeU32(command.parentId);
      writer.writeU32(command.childId);
      writer.writeU32(command.index);
      break;
    case 'REMOVE_CHILD':
      writer.writeU8(Opcode.REMOVE_CHILD);
      writer.writeU32(command.parentId);
      writer.writeU32(command.childId);
      break;
    case 'SET_PROPERTY':
      writer.writeU8(Opcode.SET_PROPERTY);
      writer.writeU32(command.nodeId);
      writer.writeU16(command.propertyId);
      encodePropertyValue(writer, command.value);
      break;
    case 'SET_DESIGN_TOKEN':
      writer.writeU8(Opcode.SET_DESIGN_TOKEN);
      writer.writeU32(0);
      writer.writeString(command.tokenPath);
      encodePropertyValue(writer, command.value);
      break;
    case 'REGISTER_EVENT_HANDLER':
      writer.writeU8(Opcode.REGISTER_EVENT_HANDLER);
      writer.writeU32(command.nodeId);
      writer.writeU8(command.eventType);
      writer.writeU8(0x01);
      writer.writeU32(command.handlerId);
      break;
    case 'DISPATCH_EVENT':
      writer.writeU8(Opcode.DISPATCH_EVENT);
      writer.writeU32(command.targetId);
      writer.writeU8(command.eventType);
      writer.writeU32(Math.floor(Date.now() / 1000));
      writer.writeU8(0x01);
      break;
    case 'SET_ENVIRONMENT':
      writer.writeU8(Opcode.SET_ENVIRONMENT);
      writeEnvironmentFields(writer, command.fields);
      break;
    case 'UPDATE_ENVIRONMENT':
      writer.writeU8(Opcode.UPDATE_ENVIRONMENT);
      writeEnvironmentFields(writer, command.fields);
      break;
    case 'REQUEST_ENVIRONMENT':
      writer.writeU8(Opcode.REQUEST_ENVIRONMENT);
      writer.writeU8(command.requestId);
      if (command.fieldIds.length === 0) {
        writer.writeU8(0xFF);
      } else {
        writer.writeU8(command.fieldIds.length);
        for (const id of command.fieldIds) {
          writer.writeU8(id);
        }
      }
      break;
    default:
      throw new Error(`Unknown command opcode: ${(command as any).opcode}`);
  }
}

function writeEnvironmentFields(writer: BinaryWriter, fields: Map<number, PropertyValue>): void {
  writer.writeU8(fields.size);
  for (const [id, value] of fields) {
    writer.writeU8(id);
    const temp = new BinaryWriter();
    encodePropertyValue(temp, value);
    writer.writeU8(temp.length);
    writer.writeBytes(temp.toArray());
  }
}

function encodePropertyValue(writer: BinaryWriter, value: PropertyValue): void {
  switch (value.type) {
    case 'u8':
      writer.writeU8(0x01);
      writer.writeU8(value.value);
      break;
    case 'u32':
      writer.writeU8(0x02);
      writer.writeU32(value.value);
      break;
    case 'i32':
      writer.writeU8(0x03);
      writer.writeI32(value.value);
      break;
    case 'f32':
      writer.writeU8(0x04);
      writer.writeF32(value.value);
      break;
    case 'string':
      writer.writeU8(0x05);
      writer.writeString(value.value);
      break;
    case 'enum':
      writer.writeU8(0x06);
      writer.writeU8(value.value);
      break;
    case 'color':
      writer.writeU8(0x07);
      if (value.kind === 'semantic') {
        writer.writeU8(0x01);
        writer.writeU16(value.tokenId);
      } else {
        writer.writeU8(0x02);
        writer.writeU32(value.rgba);
      }
      break;
    case 'designToken':
      writer.writeU8(0x08);
      writer.writeString(value.path);
      break;
  }
}

// ============================================
// DECODING
// ============================================

export function decodeMessage(buffer: Uint8Array): DecodedMessage {
  const reader = new BinaryReader(buffer);
  const version = reader.readU16();
  const count = reader.readU32();
  const commands: Command[] = [];
  for (let i = 0; i < count; i++) {
    const opcode = reader.readU8();
    const cmd = decodeCommand(reader, opcode);
    if (cmd) commands.push(cmd);
    else console.warn(`Skipping unknown opcode: ${opcode} at position ${reader.position}`);
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
    case Opcode.REGISTER_EVENT_HANDLER:
      return decodeRegisterEventHandler(reader);
    case Opcode.DISPATCH_EVENT:
      return decodeDispatchEvent(reader);
    case Opcode.SET_ENVIRONMENT:
      return decodeSetEnvironment(reader);
    case Opcode.UPDATE_ENVIRONMENT:
      return decodeUpdateEnvironment(reader);
    case Opcode.REQUEST_ENVIRONMENT:
      return decodeRequestEnvironment(reader);
    default:
      return null;
  }
}

function decodeCreateNode(reader: BinaryReader): Command {
  const nodeId = reader.readU32();
  const componentType = reader.readU16();
  const count = reader.readU8();
  const properties = new Map<number, PropertyValue>();
  for (let i = 0; i < count; i++) {
    const id = reader.readU16();
    const value = decodePropertyValue(reader);
    properties.set(id, value);
  }
  return { opcode: 'CREATE_NODE', nodeId, componentType, properties };
}

function decodeDeleteNode(reader: BinaryReader): Command {
  return { opcode: 'DELETE_NODE', nodeId: reader.readU32() };
}

function decodeInsertChild(reader: BinaryReader): Command {
  return { opcode: 'INSERT_CHILD', parentId: reader.readU32(), childId: reader.readU32(), index: reader.readU32() };
}

function decodeRemoveChild(reader: BinaryReader): Command {
  return { opcode: 'REMOVE_CHILD', parentId: reader.readU32(), childId: reader.readU32() };
}

function decodeSetProperty(reader: BinaryReader): Command {
  return { opcode: 'SET_PROPERTY', nodeId: reader.readU32(), propertyId: reader.readU16(), value: decodePropertyValue(reader) };
}

function decodeSetDesignToken(reader: BinaryReader): Command {
  reader.readU32();
  return { opcode: 'SET_DESIGN_TOKEN', tokenPath: reader.readString(), value: decodePropertyValue(reader) };
}

function decodeRegisterEventHandler(reader: BinaryReader): Command {
  const nodeId = reader.readU32();
  const eventType = reader.readU8();
  reader.readU8();
  const handlerId = reader.readU32();
  return { opcode: 'REGISTER_EVENT_HANDLER', nodeId, eventType, handlerId };
}

function decodeDispatchEvent(reader: BinaryReader): Command {
  const targetId = reader.readU32();
  const eventType = reader.readU8();
  reader.readU32();
  reader.readU8();
  return { opcode: 'DISPATCH_EVENT', targetId, eventType };
}

function decodeSetEnvironment(reader: BinaryReader): Command {
  return decodeEnvCmd(reader, 'SET_ENVIRONMENT');
}

function decodeUpdateEnvironment(reader: BinaryReader): Command {
  return decodeEnvCmd(reader, 'UPDATE_ENVIRONMENT');
}

function decodeEnvCmd(reader: BinaryReader, opcode: 'SET_ENVIRONMENT' | 'UPDATE_ENVIRONMENT'): Command {
  const count = reader.readU8();
  const fields = new Map<number, PropertyValue>();
  for (let i = 0; i < count; i++) {
    const id = reader.readU8();
    const size = reader.readU8();
    const value = decodeEnvField(reader, id, size);
    fields.set(id, value);
  }
  return { opcode, fields };
}

function decodeRequestEnvironment(reader: BinaryReader): Command {
  const requestId = reader.readU8();
  const marker = reader.readU8();
  const fieldIds: number[] = [];
  if (marker === 0xFF) {
    return { opcode: 'REQUEST_ENVIRONMENT', requestId, fieldIds };
  }
  for (let i = 0; i < marker; i++) {
    fieldIds.push(reader.readU8());
  }
  return { opcode: 'REQUEST_ENVIRONMENT', requestId, fieldIds };
}

function decodePropertyValue(reader: BinaryReader): PropertyValue {
  const type = reader.readU8();
  switch (type) {
    case 0x01: return { type: 'u8', value: reader.readU8() };
    case 0x02: return { type: 'u32', value: reader.readU32() };
    case 0x03: return { type: 'i32', value: reader.readI32() };
    case 0x04: return { type: 'f32', value: reader.readF32() };
    case 0x05: return { type: 'string', value: reader.readString() };
    case 0x06: return { type: 'enum', value: reader.readU8() };
    case 0x07: {
      const kind = reader.readU8();
      if (kind === 0x01) return { type: 'color', kind: 'semantic', tokenId: reader.readU16() };
      return { type: 'color', kind: 'literal', rgba: reader.readU32() };
    }
    case 0x08: return { type: 'designToken', path: reader.readString() };
    default: throw new Error(`Unknown value type: ${type}`);
  }
}

function decodeEnvField(reader: BinaryReader, id: number, size: number): PropertyValue {
  const f32 = [0x05, 0x0D];
  const str = [0x13, 0x14];
  const u8 = [0x0A, 0x0B, 0x0E, 0x0F, 0x10, 0x12, 0x0C, 0x11];
  const u32 = [0x01, 0x02, 0x03, 0x04, 0x06, 0x07, 0x08, 0x09];
  if (u32.includes(id)) return { type: 'u32', value: reader.readU32() };
  if (f32.includes(id)) return { type: 'f32', value: reader.readF32() };
  if (u8.includes(id)) return { type: 'u8', value: reader.readU8() };
  if (str.includes(id)) return { type: 'string', value: reader.readString() };
  reader.skip(size);
  return { type: 'u8', value: 0 };
}
