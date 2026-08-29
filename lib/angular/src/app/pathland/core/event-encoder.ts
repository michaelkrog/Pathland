import { EVENT, CATEGORY } from './protocol';
import { Opcode } from './frame';
import { encodeBatch, StringSectionWriter, HOST_TO_GUEST } from './decoder';

/**
 * Host → guest raw-input event encoding (the client → server direction of the
 * `PLPL` batch format), mirroring the Java `FrameCodec.encodeEvents` and the
 * `app.js` `encode*` helpers.
 */
export const eventRouter = {
  /** A pointer-up (tap) on a node, encoded as a single-opcode batch. */
  pointerUp(target: number): Uint8Array {
    return encodeBatch(
      [new Opcode(CATEGORY.EVENT, EVENT.POINTER_UP, 0, target, 0, 0)],
      new Uint8Array(),
      HOST_TO_GUEST,
    );
  },

  /** A control's value changed (e.g. a slider), `B = value (f32 bits)`. */
  valueChanged(target: number, value: number): Uint8Array {
    return encodeBatch(
      [new Opcode(CATEGORY.EVENT, EVENT.VALUE_CHANGED, 0, target, f32Bits(value), 0)],
      new Uint8Array(),
      HOST_TO_GUEST,
    );
  },

  /** A control's value changed, `B = raw 32-bit payload` (e.g. a packed ARGB color). */
  valueBits(target: number, bits: number): Uint8Array {
    return encodeBatch(
      [new Opcode(CATEGORY.EVENT, EVENT.VALUE_CHANGED, 0, target, bits >>> 0, 0)],
      new Uint8Array(),
      HOST_TO_GUEST,
    );
  },

  /** A text field's value changed; the text rides in the batch's string section. */
  textChanged(target: number, text: string): Uint8Array {
    const strings = new StringSectionWriter();
    const offset = strings.push(text);
    return encodeBatch(
      [new Opcode(CATEGORY.EVENT, EVENT.TEXT_CHANGED, 0, target, offset, 0)],
      strings.toBytes(),
      HOST_TO_GUEST,
    );
  },

  /** A date picker's value changed, `B`=days since epoch, `C`=millis of day. */
  dateChanged(target: number, days: number, millis = 0): Uint8Array {
    return encodeBatch(
      [new Opcode(CATEGORY.EVENT, EVENT.DATE_CHANGED, 0, target, days >>> 0, millis >>> 0)],
      new Uint8Array(),
      HOST_TO_GUEST,
    );
  },
};

/** Pack a JS number as the raw bits of an `f32` (the wire value of F32 props/events). */
export function f32Bits(value: number): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, true);
  return view.getUint32(0, true);
}

/** Unpack raw `f32` bits back into a JS number. */
export function f32FromBits(bits: number): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setUint32(0, bits, true);
  return view.getFloat32(0, true);
}