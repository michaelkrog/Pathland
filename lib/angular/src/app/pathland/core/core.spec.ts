import { describe, it, expect } from 'vitest';
import { CATEGORY, TREE, STYLE, COMPONENT, PROPERTY, VALUE_TYPE, EVENT } from './protocol';
import { Opcode } from './frame';
import { decodeFrame, encodeBatch, StringSectionWriter } from './decoder';
import { eventRouter, f32Bits, f32FromBits } from './event-encoder';
import { RetainedTree } from './retained-tree';

/** Build a self-contained mount frame: VSTACK(1) → [TEXT(2) "Hello"]. */
function mountFrame(): Uint8Array {
  const strings = new StringSectionWriter();
  const hello = strings.push('Hello');
  return encodeBatch([
    new Opcode(CATEGORY.TREE, TREE.CREATE_NODE, 0, 1, COMPONENT.VSTACK, 0),
    new Opcode(CATEGORY.TREE, TREE.CREATE_NODE, 0, 2, COMPONENT.TEXT, 0),
    new Opcode(CATEGORY.TREE, TREE.INSERT_CHILD, 0, 1, 2, 0xffffffff),
    new Opcode(CATEGORY.STYLE, STYLE.SET_TEXT, 0, 2, hello, 0),
  ], strings.toBytes());
}

describe('protocol constants', () => {
  it('matches the canonical spec component/property ids', () => {
    expect(COMPONENT.TEXT).toBe(0x01);
    expect(COMPONENT.COLOR).toBe(0x03);
    expect(COMPONENT.VSTACK).toBe(0x10);
    expect(COMPONENT.HSTACK).toBe(0x11);
    expect(COMPONENT.TOGGLE).toBe(0x24);
    expect(COMPONENT.SLIDER).toBe(0x25);
    expect(COMPONENT.COMMENT).toBe(0x7f);
    expect(PROPERTY.PADDING).toBe(0x1011);
    expect(PROPERTY.COLOR).toBe(0x100a);
    expect(PROPERTY.TINT).toBe(0x1030);
    expect(VALUE_TYPE.STRING).toBe(0x05);
  });
});

describe('decodeFrame', () => {
  it('round-trips opcodes and the string section', () => {
    const frame = decodeFrame(mountFrame());
    expect(frame.opcodes.length).toBe(4);
    expect(frame.opcodes[0].category).toBe(CATEGORY.TREE);
    expect(frame.opcodes[0].command).toBe(TREE.CREATE_NODE);
    expect(frame.opcodes[0].a).toBe(1);
    expect(frame.opcodes[2].command).toBe(TREE.INSERT_CHILD);
    expect(frame.opcodes[2].a).toBe(1);
    expect(frame.opcodes[2].b).toBe(2);
    expect(frame.stringAt(frame.opcodes[3].b)).toBe('Hello');
  });

  it('rejects a bad magic', () => {
    expect(() => decodeFrame(new Uint8Array(32))).toThrow(/magic/);
  });
});

describe('eventRouter', () => {
  it('encodes pointer-up events', () => {
    const bytes = eventRouter.pointerUp(4);
    const frame = decodeFrame(bytes);
    expect(frame.opcodes.length).toBe(1);
    expect(frame.opcodes[0].category).toBe(CATEGORY.EVENT);
    expect(frame.opcodes[0].command).toBe(EVENT.POINTER_UP);
    expect(frame.opcodes[0].a).toBe(4);
  });

  it('encodes text-changed with the text in the string section', () => {
    const bytes = eventRouter.textChanged(7, 'Ada');
    const frame = decodeFrame(bytes);
    expect(frame.opcodes[0].command).toBe(EVENT.TEXT_CHANGED);
    expect(frame.opcodes[0].a).toBe(7);
    expect(frame.stringAt(frame.opcodes[0].b)).toBe('Ada');
  });

  it('encodes value-changed as f32 bits', () => {
    const bytes = eventRouter.valueChanged(6, 0.75);
    const frame = decodeFrame(bytes);
    expect(frame.opcodes[0].command).toBe(EVENT.VALUE_CHANGED);
    expect(f32FromBits(frame.opcodes[0].b)).toBeCloseTo(0.75);
  });

  it('encodes raw value bits and date-changed', () => {
    const raw = decodeFrame(eventRouter.valueBits(8, 0xff2196f3));
    expect(raw.opcodes[0].command).toBe(EVENT.VALUE_CHANGED);
    expect(raw.opcodes[0].b).toBe(0xff2196f3);

    const date = decodeFrame(eventRouter.dateChanged(9, 20487, 0));
    expect(date.opcodes[0].command).toBe(EVENT.DATE_CHANGED);
    expect(date.opcodes[0].b).toBe(20487);
  });

  it('packs/unpacks f32 bits', () => {
    expect(f32FromBits(f32Bits(1))).toBe(1);
    expect(f32FromBits(f32Bits(0.5))).toBe(0.5);
  });
});

describe('RetainedTree', () => {
  it('applies a mount frame and resolves string properties', () => {
    const tree = new RetainedTree();
    tree.applyFrame(decodeFrame(mountFrame()));

    expect(tree.rootId).toBe(1);
    const root = tree.node(1);
    expect(root?.component).toBe(COMPONENT.VSTACK);
    expect(root?.children()).toEqual([2]);

    const text = tree.node(2);
    expect(text?.component).toBe(COMPONENT.TEXT);
    expect(text?.text()).toBe('Hello');
  });

  it('applies SET_PROPERTY with raw bits and string sections', () => {
    const strings = new StringSectionWriter();
    const prompt = strings.push('Your name');
    const bytes = encodeBatch([
      new Opcode(CATEGORY.TREE, TREE.CREATE_NODE, 0, 1, COMPONENT.TEXT_FIELD, 0),
      new Opcode(CATEGORY.STYLE, STYLE.SET_PROPERTY, 0, 1,
        (VALUE_TYPE.F32 << 16) | PROPERTY.FONT_SIZE, f32Bits(20)),
      new Opcode(CATEGORY.STYLE, STYLE.SET_PROPERTY, 0, 1,
        (VALUE_TYPE.STRING << 16) | PROPERTY.PROMPT, prompt),
    ], strings.toBytes());

    const tree = new RetainedTree();
    tree.applyFrame(decodeFrame(bytes));

    const node = tree.node(1)!;
    expect(node.f32(PROPERTY.FONT_SIZE)).toBe(20);
    expect(node.strings().get(PROPERTY.PROMPT)).toBe('Your name');
  });

  it('supports insert/remove/move child deltas', () => {
    const tree = new RetainedTree();
    tree.applyFrame(decodeFrame(mountFrame()));
    tree.applyFrame(decodeFrame(encodeBatch([
      new Opcode(CATEGORY.TREE, TREE.REMOVE_CHILD, 0, 1, 2, 0),
    ], new Uint8Array())));
    expect(tree.node(1)?.children()).toEqual([]);
  });

  it('applies STYLE::SET_DATE to a date picker node', () => {
    const bytes = encodeBatch([
      new Opcode(CATEGORY.TREE, TREE.CREATE_NODE, 0, 1, COMPONENT.DATE_PICKER, 0),
      new Opcode(CATEGORY.STYLE, STYLE.SET_DATE, 0, 1, 20487, 43200000),
    ], new Uint8Array());

    const tree = new RetainedTree();
    tree.applyFrame(decodeFrame(bytes));

    expect(tree.node(1)?.date()).toEqual({ days: 20487, millis: 43200000 });
  });
});