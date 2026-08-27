import { Opcode, Frame } from './frame';

/**
 * The `PLPL` network batch codec — the TypeScript mirror of the Java
 * `com.pathland.view.transport.FrameCodec` and the Rust `pathland_core_transport`.
 *
 * Batch wire format (both directions share the header):
 *
 * ```
 * magic "PLPL" (u32 LE) | version (u16) | flags (u16) | frameCount (u32)
 * | opcodeCount (u32) | opcodes (16 B × count) | stringsLen (u32) | string bytes
 * ```
 *
 * Frames are self-contained: `SET_TEXT` / STRING-valued `SET_PROPERTY` reference
 * entries in the batch's own string section by *relative* offset.
 */
export const BATCH_MAGIC = 0x504c_504c; // "PLPL"
export const BATCH_VERSION = 1;
export const HOST_TO_GUEST = 0x0001;
export const HEADER_BYTES = 16;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Decode a `PLPL` batch into a frame (opcodes + string section). */
export function decodeFrame(bytes: Uint8Array): Frame {
  if (bytes.byteLength < HEADER_BYTES) {
    throw new Error('batch truncated');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== BATCH_MAGIC) {
    throw new Error('bad batch magic');
  }
  if (view.getUint16(4, true) !== BATCH_VERSION) {
    throw new Error('unsupported batch version');
  }
  const opcodeCount = view.getUint32(12, true);
  const opcodesEnd = HEADER_BYTES + opcodeCount * 16;
  if (opcodesEnd + 4 > bytes.byteLength) {
    throw new Error('batch truncated (opcodes)');
  }
  const opcodes: Opcode[] = new Array(opcodeCount);
  for (let i = 0; i < opcodeCount; i++) {
    const pos = HEADER_BYTES + i * 16;
    opcodes[i] = new Opcode(
      view.getUint8(pos),
      view.getUint8(pos + 1),
      view.getUint16(pos + 2, true),
      view.getUint32(pos + 4, true),
      view.getUint32(pos + 8, true),
      view.getUint32(pos + 12, true),
    );
  }
  const stringsLen = view.getUint32(opcodesEnd, true);
  const stringsStart = opcodesEnd + 4;
  if (stringsStart + stringsLen > bytes.byteLength) {
    throw new Error('batch truncated (strings)');
  }
  const strings = bytes.subarray(stringsStart, stringsStart + stringsLen);
  return new Frame(opcodes, strings);
}

/** Read a length-prefixed string (`[u32 len][bytes]`) at a relative offset. */
export function stringAt(strings: Uint8Array, offset: number): string {
  const view = new DataView(strings.buffer, strings.byteOffset, strings.byteLength);
  const len = view.getUint32(offset, true);
  return decoder.decode(strings.subarray(offset + 4, offset + 4 + len));
}

/**
 * Encode a frame (or host→guest event batch) as a `PLPL` byte array.
 * `flags` selects the direction (`HOST_TO_GUEST` for events).
 */
export function encodeBatch(
  opcodes: Opcode[],
  strings: Uint8Array,
  flags = 0,
): Uint8Array {
  const opcodesEnd = HEADER_BYTES + opcodes.length * 16;
  const out = new Uint8Array(opcodesEnd + 4 + strings.byteLength);
  const view = new DataView(out.buffer);
  view.setUint32(0, BATCH_MAGIC, true);
  view.setUint16(4, BATCH_VERSION, true);
  view.setUint16(6, flags, true);
  view.setUint32(8, 0, true); // frameCount
  view.setUint32(12, opcodes.length, true);
  for (let i = 0; i < opcodes.length; i++) {
    const pos = HEADER_BYTES + i * 16;
    const op = opcodes[i];
    view.setUint8(pos, op.category);
    view.setUint8(pos + 1, op.command);
    view.setUint16(pos + 2, op.flags, true);
    view.setUint32(pos + 4, op.a, true);
    view.setUint32(pos + 8, op.b, true);
    view.setUint32(pos + 12, op.c, true);
  }
  view.setUint32(opcodesEnd, strings.byteLength, true);
  out.set(strings, opcodesEnd + 4);
  return out;
}

/** A growable string-section writer returning each entry's relative offset. */
export class StringSectionWriter {
  private readonly bytes: number[] = [];

  /** The byte length of the string section so far. */
  size(): number {
    return this.bytes.length;
  }

  /** Append a length-prefixed UTF-8 string; returns its relative offset. */
  push(text: string): number {
    const offset = this.bytes.length;
    const utf8 = encoder.encode(text);
    this.bytes.push(utf8.length & 0xff, (utf8.length >>> 8) & 0xff,
      (utf8.length >>> 16) & 0xff, (utf8.length >>> 24) & 0xff);
    for (const b of utf8) {
      this.bytes.push(b);
    }
    return offset;
  }

  /** The string section bytes. */
  toBytes(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}