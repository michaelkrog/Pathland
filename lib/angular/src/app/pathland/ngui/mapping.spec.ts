import { describe, it, expect } from 'vitest';
import { COMPONENT, PROPERTY, VALUE_TYPE, SIZE, BORDER_EDGE, TOGGLE_STYLE, SHAPE_KIND } from '../core/protocol';
import { Opcode } from '../core/frame';
import { encodeBatch } from '../core/decoder';
import { decodeFrame } from '../core/decoder';
import { f32Bits } from '../core/event-encoder';
import { RetainedTree } from '../core/retained-tree';
import { argbToRgba, buildMods, datePickerMode, hidden, kindOf, pickerStyle, secure, selectionString, shapeKind, slider, stackGap, toggleStyle } from './mapping';

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
  it('maps stack/text/button/control kinds to spec component ids', () => {
    const tree = nodeWith(COMPONENT.VSTACK, []);
    expect(kindOf(tree.node(1)!)).toBe('vstack');
    const text = nodeWith(COMPONENT.TEXT, []);
    expect(kindOf(text.node(1)!)).toBe('text');
    const button = nodeWith(COMPONENT.BUTTON, []);
    expect(kindOf(button.node(1)!)).toBe('button');
    const field = nodeWith(COMPONENT.TEXT_FIELD, []);
    expect(kindOf(field.node(1)!)).toBe('textField');
    const toggle = nodeWith(COMPONENT.TOGGLE, []);
    expect(kindOf(toggle.node(1)!)).toBe('toggle');
    const slider = nodeWith(COMPONENT.SLIDER, []);
    expect(kindOf(slider.node(1)!)).toBe('slider');
    const picker = nodeWith(COMPONENT.PICKER, []);
    expect(kindOf(picker.node(1)!)).toBe('picker');
    const color = nodeWith(COMPONENT.COLOR, []);
    expect(kindOf(color.node(1)!)).toBe('color');
    const date = nodeWith(COMPONENT.DATE_PICKER, []);
    expect(kindOf(date.node(1)!)).toBe('datePicker');
  });

  it('decodes toggle style from the TOGGLE_STYLE token', () => {
    const checkbox = nodeWith(COMPONENT.TOGGLE, [
      [PROPERTY.TOGGLE_STYLE, VALUE_TYPE.F32, f32Bits(TOGGLE_STYLE.CHECKBOX)],
    ]);
    expect(toggleStyle(checkbox.node(1)!)).toBe('checkbox');

    const button = nodeWith(COMPONENT.TOGGLE, [
      [PROPERTY.TOGGLE_STYLE, VALUE_TYPE.F32, f32Bits(TOGGLE_STYLE.BUTTON)],
    ]);
    expect(toggleStyle(button.node(1)!)).toBe('button');

    const switchNode = nodeWith(COMPONENT.TOGGLE, []);
    expect(toggleStyle(switchNode.node(1)!)).toBe('switch');
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
      [PROPERTY.VISIBLE, VALUE_TYPE.U8, 0],
    ]);
    expect(hidden(hiddenNode.node(1)!)).toBe(true);

    const stack = nodeWith(COMPONENT.HSTACK, [
      [PROPERTY.SPACING, VALUE_TYPE.F32, f32Bits(12)],
    ]);
    expect(stackGap(stack.node(1)!)).toBe(12);
  });

  it('decodes control style tokens', () => {
    const segmented = nodeWith(COMPONENT.PICKER, [
      [PROPERTY.PICKER_STYLE, VALUE_TYPE.F32, f32Bits(1)],
      [PROPERTY.SELECTION, VALUE_TYPE.U32, 2],
    ]);
    expect(pickerStyle(segmented.node(1)!)).toBe('segmented');
    expect(selectionString(segmented.node(1)!)).toBe('2');

    const date = nodeWith(COMPONENT.DATE_PICKER, [
      [PROPERTY.DATE_PICKER_MODE, VALUE_TYPE.F32, f32Bits(2)],
    ]);
    expect(datePickerMode(date.node(1)!)).toBe('dateAndTime');

    const secret = nodeWith(COMPONENT.TEXT_FIELD, [
      [PROPERTY.IS_SECURE, VALUE_TYPE.U8, 1],
    ]);
    expect(secure(secret.node(1)!)).toBe(true);
  });

  it('decodes shape kinds and slider step', () => {
    const shape = nodeWith(COMPONENT.SHAPE, [
      [PROPERTY.SHAPE_KIND, VALUE_TYPE.F32, f32Bits(SHAPE_KIND.CIRCLE)],
    ]);
    expect(shapeKind(shape.node(1)!)).toBe(SHAPE_KIND.CIRCLE);

    const stepped = nodeWith(COMPONENT.SLIDER, [
      [PROPERTY.STEP_VALUE, VALUE_TYPE.F32, f32Bits(5)],
    ]);
    expect(slider(stepped.node(1)!).step).toBe(5);
  });

  it('decodes effects, shadow, underline, font style and frame bounds', () => {
    const tree = nodeWith(COMPONENT.TEXT, [
      [PROPERTY.SHADOW_RADIUS, VALUE_TYPE.F32, f32Bits(6)],
      [PROPERTY.SHADOW_COLOR, VALUE_TYPE.COLOR, 0xff000000],
      [PROPERTY.BLUR_RADIUS, VALUE_TYPE.F32, f32Bits(4)],
      [PROPERTY.GRAYSCALE, VALUE_TYPE.F32, f32Bits(0.5)],
      [PROPERTY.UNDERLINE, VALUE_TYPE.U8, 1],
      [PROPERTY.ROTATION_DEGREES, VALUE_TYPE.F32, f32Bits(90)],
      [PROPERTY.FONT_STYLE, VALUE_TYPE.F32, f32Bits(1)],
      [PROPERTY.LINE_SPACING, VALUE_TYPE.F32, f32Bits(6)],
      [PROPERTY.MIN_WIDTH, VALUE_TYPE.F32, f32Bits(10)],
      [PROPERTY.MAX_WIDTH, VALUE_TYPE.F32, f32Bits(200)],
    ]);
    const m = buildMods(tree.node(1)!);
    expect(m.shadow?.shadow).toContain('6px');
    expect(m.background?.filter).toBe('blur(4px) grayscale(0.5)');
    expect(m.underline).toBe(true);
    expect(m.rotation).toBe(90);
    expect(m.font?.style).toBe('italic');
    expect(m.font?.lineHeight).toBe('6px');
    expect(m.frame).toEqual({ minWidth: '10px', maxWidth: '200px' });
  });

  it('formats ARGB colors as rgba', () => {
    expect(argbToRgba(0xffff0000)).toBe('rgba(255,0,0,1.000)');
    expect(argbToRgba(0x80808080)).toBe('rgba(128,128,128,0.502)');
  });
});