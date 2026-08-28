import { describe, it, expect } from 'vitest';
import { COMPONENT, PROPERTY, VALUE_TYPE, SIZE, BORDER_EDGE } from '../core/protocol';
import { Opcode } from '../core/frame';
import { encodeBatch } from '../core/decoder';
import { decodeFrame } from '../core/decoder';
import { f32Bits } from '../core/event-encoder';
import { RetainedTree } from '../core/retained-tree';
import { argbToRgba, buildMods, hidden, kindOf, stackGap } from './mapping';

/** Build a node with the given SET_PROPERTY ops applied. */
function nodeWith(component: number, props: [number, number, number][]): RetainedTree {
  const opcodes = [new Opcode(1, 1, 0, 1, component, 0)]; // TREE.CREATE_NODE
  for (const [property, valueType, value] of props) {
    opcodes.push(new Opcode(2, 1, 0, 1, (valueType << 16) | property, value)); // STYLE.SET_PROPERTY
  }
  const tree = new RetainedTree();
  tree.applyFrame(decodeFrame(encodeBatch(opcodes, new Uint8Array())));
  return tree;
}

describe('mapping', () => {
  it('maps stack/text/button kinds', () => {
    const tree = nodeWith(COMPONENT.VSTACK, []);
    expect(kindOf(tree.node(1)!)).toBe('vstack');
    const text = nodeWith(COMPONENT.TEXT, []);
    expect(kindOf(text.node(1)!)).toBe('text');
    const button = nodeWith(COMPONENT.BUTTON, []);
    expect(kindOf(button.node(1)!)).toBe('button');
    const field = nodeWith(COMPONENT.TEXT_FIELD, []);
    expect(kindOf(field.node(1)!)).toBe('textField');
  });

  it('decodes padding/color/background/font/frame modifiers', () => {
    const tree = nodeWith(COMPONENT.TEXT, [
      [PROPERTY.PADDING, VALUE_TYPE.F32, f32Bits(16)],
      [PROPERTY.COLOR, VALUE_TYPE.COLOR, 0xff888888],
      [PROPERTY.BACKGROUND_COLOR, VALUE_TYPE.COLOR, 0xff2196f3],
      [PROPERTY.FONT_SIZE, VALUE_TYPE.F32, f32Bits(20)],
      [PROPERTY.WIDTH, VALUE_TYPE.F32, f32Bits(100)],
      [PROPERTY.HEIGHT, VALUE_TYPE.F32, f32Bits(SIZE.FILL)],
    ]);
    const m = buildMods(tree.node(1)!);
    expect(m.padding).toEqual({ paddingAreas: [{ edge: 'All', gap: 16 }] });
    expect(m.color).toBe('rgba(136,136,136,1.000)');
    expect(m.background).toEqual({ color: 'rgba(33,150,243,1.000)' });
    expect(m.font).toEqual({ size: '20px' });
    expect(m.frame).toEqual({ width: '100px' });
    expect(m.flex).toEqual({ grow: 1, basis: '100%' });
  });

  it('decodes borders and rounding', () => {
    const tree = nodeWith(COMPONENT.BUTTON, [
      [PROPERTY.BORDER_WIDTH, VALUE_TYPE.F32, f32Bits(2)],
      [PROPERTY.BORDER_COLOR, VALUE_TYPE.COLOR, 0xffff0000],
      [PROPERTY.BORDER_EDGES, VALUE_TYPE.U32, BORDER_EDGE.ALL],
      [PROPERTY.BORDER_RADIUS, VALUE_TYPE.F32, f32Bits(6)],
    ]);
    const m = buildMods(tree.node(1)!);
    expect(m.border).toEqual({
      borderAreas: [{ side: 'All', width: 2 }],
      color: 'rgba(255,0,0,1.000)',
    });
    expect(m.rounding).toEqual({ radius: 6 });
  });

  it('handles visibility and stack spacing', () => {
    const hiddenNode = nodeWith(COMPONENT.TEXT, [
      [PROPERTY.VISIBLE, VALUE_TYPE.F32, f32Bits(0)],
    ]);
    expect(hidden(hiddenNode.node(1)!)).toBe(true);

    const stack = nodeWith(COMPONENT.HSTACK, [
      [PROPERTY.SPACING, VALUE_TYPE.F32, f32Bits(12)],
    ]);
    expect(stackGap(stack.node(1)!)).toBe(12);
  });

  it('formats ARGB colors as rgba', () => {
    expect(argbToRgba(0xffff0000)).toBe('rgba(255,0,0,1.000)');
    expect(argbToRgba(0x80808080)).toBe('rgba(128,128,128,0.502)');
  });
});