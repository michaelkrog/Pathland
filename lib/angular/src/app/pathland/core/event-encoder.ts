import { EVENT, CATEGORY } from './protocol';
import { Opcode } from './frame';
import { encodeBatch, StringSectionWriter, HOST_TO_GUEST } from './decoder';

/**
 * Host → guest raw-input event encoding (the client → server direction of the
 * `PLPL` batch format), mirroring the Java `FrameCodec.encodeEvents` and the
 * `app.js` `encode*` helpers.
 */
export const eventRouter = {
  /** A pointer-down on a node (`B`/`C` = logical x/y as f32 bits). */
  pointerDown(target: number, x: number, y: number): Uint8Array {
    return encodeBatch(
      [new Opcode(CATEGORY.EVENT, EVENT.POINTER_DOWN, 0, target, f32Bits(x), f32Bits(y))],
      new Uint8Array(),
      HOST_TO_GUEST,
    );
  },

  /** A pointer move (hover/drag) on a node, with hover enter/leave flags. */
  pointerMove(target: number, x: number, y: number, flags = 0): Uint8Array {
    return encodeBatch(
      [new Opcode(CATEGORY.EVENT, EVENT.POINTER_MOVE, flags, target, f32Bits(x), f32Bits(y))],
      new Uint8Array(),
      HOST_TO_GUEST,
    );
  },

  /** A pointer-up (tap) on a node, encoded as a single-opcode batch. */
  pointerUp(target: number): Uint8Array {
    return encodeBatch(
      [new Opcode(CATEGORY.EVENT, EVENT.POINTER_UP, 0, target, 0, 0)],
      new Uint8Array(),
      HOST_TO_GUEST,
    );
  },

  /** A key pressed on the focused node (`B`=keyCode, `C`=modifier bits, flags). */
  keyDown(target: number, keyCode: number, modifiers: number, flags = 0): Uint8Array {
    return encodeBatch(
      [new Opcode(CATEGORY.EVENT, EVENT.KEY_DOWN, flags, target, keyCode >>> 0, modifiers >>> 0)],
      new Uint8Array(),
      HOST_TO_GUEST,
    );
  },

  /** A key released on the focused node (`B`=keyCode, `C`=modifier bits). */
  keyUp(target: number, keyCode: number, modifiers: number): Uint8Array {
    return encodeBatch(
      [new Opcode(CATEGORY.EVENT, EVENT.KEY_UP, 0, target, keyCode >>> 0, modifiers >>> 0)],
      new Uint8Array(),
      HOST_TO_GUEST,
    );
  },

  /** Focus gained/lost (`B` = 1/0). */
  focusChanged(target: number, focused: boolean): Uint8Array {
    return encodeBatch(
      [new Opcode(CATEGORY.EVENT, EVENT.FOCUS_CHANGED, 0, target, focused ? 1 : 0, 0)],
      new Uint8Array(),
      HOST_TO_GUEST,
    );
  },

  /** An editing session began/ended (`B` = 1/0). */
  editingChanged(target: number, editing: boolean): Uint8Array {
    return encodeBatch(
      [new Opcode(CATEGORY.EVENT, EVENT.EDITING_CHANGED, 0, target, editing ? 1 : 0, 0)],
      new Uint8Array(),
      HOST_TO_GUEST,
    );
  },

  /** The user committed the field (submit). */
  submit(target: number): Uint8Array {
    return encodeBatch(
      [new Opcode(CATEGORY.EVENT, EVENT.SUBMIT, 0, target, 0, 0)],
      new Uint8Array(),
      HOST_TO_GUEST,
    );
  },

  /** A scroll view's absolute content offset (`B`/`C` = x/y as f32 bits). */
  scroll(target: number, offsetX: number, offsetY: number): Uint8Array {
    return encodeBatch(
      [new Opcode(CATEGORY.EVENT, EVENT.SCROLL, 0, target, f32Bits(offsetX), f32Bits(offsetY))],
      new Uint8Array(),
      HOST_TO_GUEST,
    );
  },

  /** Raw wheel/trackpad deltas (`B`/`C` = dx/dy as f32 bits). */
  wheel(target: number, deltaX: number, deltaY: number): Uint8Array {
    return encodeBatch(
      [new Opcode(CATEGORY.EVENT, EVENT.WHEEL, 0, target, f32Bits(deltaX), f32Bits(deltaY))],
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