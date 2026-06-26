import { LITTLE_ENDIAN } from './constants';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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
    this.buffer[this.cursor++] = value;
  }

  writeU16(value: number): void {
    this.ensureCapacity(2);
    this.view.setUint16(this.cursor, value, LITTLE_ENDIAN);
    this.cursor += 2;
  }

  writeU32(value: number): void {
    this.ensureCapacity(4);
    this.view.setUint32(this.cursor, value, LITTLE_ENDIAN);
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
    const bytes = textEncoder.encode(value);
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
    const value = this.buffer[this.cursor++];
    return value;
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
    const value = textDecoder.decode(this.buffer.subarray(this.cursor, this.cursor + length));
    this.cursor += length;
    return value;
  }

  readBytes(length: number): Uint8Array {
    const value = this.buffer.subarray(this.cursor, this.cursor + length);
    this.cursor += length;
    return value;
  }

  get remaining(): number {
    return this.buffer.length - this.cursor;
  }

  get position(): number {
    return this.cursor;
  }

  skip(bytes: number): void {
    this.cursor += bytes;
  }
}
