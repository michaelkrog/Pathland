import { stringAt } from './decoder';

/**
 * A fixed-size 16-byte Pathland opcode (the wire format, little-endian):
 *
 * ```
 * [Category u8][Command u8][Flags u16][A u32][B u32][C u32]
 * ```
 *
 * Matches `pathland_core::Opcode` and `spec/OPCODE.md`.
 */
export class Opcode {
  constructor(
    readonly category: number,
    readonly command: number,
    readonly flags: number,
    readonly a: number,
    readonly b: number,
    readonly c: number,
  ) {}

  /** The `propertyId` carried in the low half of `B` of a `SET_PROPERTY`. */
  propertyId(): number {
    return this.b & 0xffff;
  }

  /** The `valueType` carried in the high byte of `B` of a `SET_PROPERTY`. */
  valueType(): number {
    return (this.b >>> 16) & 0xff;
  }
}

/** A self-contained frame: opcodes + the batch's own string section. */
export class Frame {
  constructor(
    readonly opcodes: Opcode[],
    readonly strings: Uint8Array,
  ) {}

  /** Resolve a relative string offset in this frame's string section. */
  stringAt(offset: number): string {
    return stringAt(this.strings, offset);
  }
}