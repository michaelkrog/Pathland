/**
 * @pathland/renderer-canvas
 *
 * Tests for the CanvasRenderer (layout, draw, hit-test, interaction) using a
 * fake CanvasRenderingContext2D that records calls.
 */

import { describe, it, expect } from 'vitest';
import { CanvasRenderer } from './index';
import { ComponentType, TextProperty, StackProperty, StyleProperty, EventType, GestureType, GestureState } from '@pathland/protocol';
import type { Command } from '@pathland/protocol';
import type { PointerInput } from '@pathland/renderer';

const FILL = -1;

interface RecordedCall {
  kind: 'fillRect' | 'fillText' | 'strokeRect' | 'scale' | 'clearRect';
  args: number[];
}

class FakeContext {
  calls: RecordedCall[] = [];
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  font = '';
  textAlign = 'left';
  textBaseline = 'alphabetic';
  globalAlpha = 1;
  private stack: { globalAlpha: number }[] = [];

  measureText(text: string): { width: number } {
    return { width: text.length * 7 };
  }
  save(): void {
    this.stack.push({ globalAlpha: this.globalAlpha });
  }
  restore(): void {
    const top = this.stack.pop();
    if (top) this.globalAlpha = top.globalAlpha;
  }
  scale(x: number, y: number): void {
    this.calls.push({ kind: 'scale', args: [x, y] });
  }
  clearRect(x: number, y: number, w: number, h: number): void {
    this.calls.push({ kind: 'clearRect', args: [x, y, w, h] });
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.calls.push({ kind: 'fillRect', args: [x, y, w, h] });
  }
  fillText(text: string, x: number, y: number): void {
    this.calls.push({ kind: 'fillText', args: [x, y] });
    (this.calls[this.calls.length - 1] as any).text = text;
  }
  beginPath(): void {}
  closePath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  quadraticCurveTo(): void {}
  fill(): void {}
  stroke(): void {}
}

function text(text: string, nodeId: number): Command {
  return {
    opcode: 'CREATE_NODE',
    nodeId,
    componentType: ComponentType.TEXT,
    properties: new Map([[TextProperty.TEXT, { type: 'string', value: text }]]),
  };
}

function stack(componentType: number, nodeId: number, properties: Array<[number, any]> = []): Command {
  return {
    opcode: 'CREATE_NODE',
    nodeId,
    componentType,
    properties: new Map(properties),
  };
}

function insert(parentId: number, childId: number, index: number): Command {
  return { opcode: 'INSERT_CHILD', parentId, childId, index };
}

function makeRenderer(commands: Command[]): { renderer: CanvasRenderer; fake: FakeContext } {
  const fake = new FakeContext();
  const renderer = new CanvasRenderer({ context: fake as unknown as CanvasRenderingContext2D, width: 300, height: 150 });
  renderer.executeCommands(commands);
  return { renderer, fake };
}

describe('CanvasRenderer layout', () => {
  it('lays out a VStack with text children vertically', () => {
    const { renderer } = makeRenderer([
      stack(ComponentType.VSTACK, 1),
      text('Hello', 2),
      text('World', 3),
      insert(1, 2, 0),
      insert(1, 3, 1),
      insert(0, 1, 0),
    ]);

    // VStack at top-left; texts stack vertically (fontSize 14 -> height 17).
    expect(renderer.getLayout(1)).toMatchObject({ x: 0, y: 0, width: 35, height: 34 });
    expect(renderer.getLayout(2)).toMatchObject({ x: 0, y: 0, width: 35, height: 17 });
    expect(renderer.getLayout(3)).toMatchObject({ x: 0, y: 17, width: 35, height: 17 });
  });

  it('applies HStack spacing between children', () => {
    const { renderer } = makeRenderer([
      stack(ComponentType.HSTACK, 1, [[StackProperty.SPACING, { type: 'f32', value: 16 }]]),
      text('AB', 2),
      text('CD', 3),
      insert(1, 2, 0),
      insert(1, 3, 1),
      insert(0, 1, 0),
    ]);
    const a = renderer.getLayout(2)!;
    const b = renderer.getLayout(3)!;
    expect(b.x - (a.x + a.width)).toBe(16);
  });

  it('justifies children with SPACE_BETWEEN', () => {
    const { renderer } = makeRenderer([
      stack(ComponentType.HSTACK, 1, [
        [StackProperty.JUSTIFICATION, { type: 'enum', value: 0x03 }],
        [StyleProperty.WIDTH, { type: 'f32', value: FILL }],
      ]),
      text('A', 2),
      text('B', 3),
      insert(1, 2, 0),
      insert(1, 3, 1),
      insert(0, 1, 0),
    ]);
    const a = renderer.getLayout(2)!;
    const b = renderer.getLayout(3)!;
    // HStack is FILL width (300); A and B at the far ends.
    expect(a.x).toBe(0);
    expect(b.x + b.width).toBe(300);
  });

  it('lets a SPACER fill the leftover main-axis space', () => {
    const { renderer } = makeRenderer([
      stack(ComponentType.HSTACK, 1, [[StyleProperty.WIDTH, { type: 'f32', value: FILL }]]),
      text('A', 2),
      stack(ComponentType.SPACER, 3),
      text('B', 4),
      insert(1, 2, 0),
      insert(1, 3, 1),
      insert(1, 4, 2),
      insert(0, 1, 0),
    ]);
    const a = renderer.getLayout(2)!;
    const spacer = renderer.getLayout(3)!;
    const b = renderer.getLayout(4)!;
    expect(a.width).toBe(7);
    expect(spacer.x).toBe(7);
    expect(spacer.width).toBe(300 - 7 - 7);
    expect(b.x).toBe(300 - 7);
  });

  it('applies padding to stack children', () => {
    const { renderer } = makeRenderer([
      stack(ComponentType.VSTACK, 1, [[StackProperty.PADDING, { type: 'f32', value: 16 }]]),
      text('Hello', 2),
      insert(1, 2, 0),
      insert(0, 1, 0),
    ]);
    expect(renderer.getLayout(2)).toMatchObject({ x: 16, y: 16 });
  });

  it('applies FILL width to a text child', () => {
    const { renderer } = makeRenderer([
      stack(ComponentType.HSTACK, 1, [[StyleProperty.WIDTH, { type: 'f32', value: FILL }]]),
      stack(ComponentType.TEXT, 2, [[TextProperty.TEXT, { type: 'string', value: 'Hi' }], [StyleProperty.WIDTH, { type: 'f32', value: FILL }]]),
      insert(1, 2, 0),
      insert(0, 1, 0),
    ]);
    expect(renderer.getLayout(2)!.width).toBe(300);
  });
});

describe('CanvasRenderer drawing', () => {
  it('draws text at its layout position', () => {
    const { fake } = makeRenderer([
      stack(ComponentType.VSTACK, 1),
      text('Hello', 2),
      insert(1, 2, 0),
      insert(0, 1, 0),
    ]);
    const fillTexts = fake.calls.filter(c => c.kind === 'fillText');
    expect(fillTexts.some(c => (c as any).text === 'Hello' && c.args[0] === 0 && c.args[1] === 0)).toBe(true);
  });

  it('redraws with new text after SET_PROPERTY', () => {
    const { renderer, fake } = makeRenderer([
      stack(ComponentType.VSTACK, 1),
      text('Hello', 2),
      insert(1, 2, 0),
      insert(0, 1, 0),
    ]);
    fake.calls.length = 0;
    renderer.executeCommands([
      { opcode: 'SET_PROPERTY', nodeId: 2, propertyId: TextProperty.TEXT, value: { type: 'string', value: 'Updated' } },
    ]);
    const fillTexts = fake.calls.filter(c => c.kind === 'fillText');
    expect(fillTexts.some(c => (c as any).text === 'Updated')).toBe(true);
  });

  it('skips drawing hidden nodes', () => {
    const { renderer, fake } = makeRenderer([
      stack(ComponentType.VSTACK, 1),
      stack(ComponentType.TEXT, 2, [[TextProperty.TEXT, { type: 'string', value: 'Hidden' }], [StyleProperty.VISIBLE, { type: 'u8', value: 0 }]]),
      insert(1, 2, 0),
      insert(0, 1, 0),
    ]);
    const fillTexts = fake.calls.filter(c => c.kind === 'fillText');
    expect(fillTexts.some(c => (c as any).text === 'Hidden')).toBe(false);
  });
});

describe('CanvasRenderer interaction', () => {
  it('hit-tests a point to the deepest node', () => {
    const { renderer } = makeRenderer([
      stack(ComponentType.VSTACK, 1),
      text('Hello', 2),
      insert(1, 2, 0),
      insert(0, 1, 0),
    ]);
    expect(renderer.hitTest(5, 5)?.id).toBe(2);
    expect(renderer.hitTest(200, 100)?.id).toBe(0); // outside the stack, hits root
  });

  it('dispatches click and hover from the pointer stream', () => {
    const { renderer } = makeRenderer([
      stack(ComponentType.VSTACK, 1),
      text('Hello', 2),
      insert(1, 2, 0),
      insert(0, 1, 0),
    ]);
    const events: any[] = [];
    renderer.setupEvents((nodeId, eventType, data) => events.push({ nodeId, eventType, data }));
    renderer.setupGestures(() => {});

    const down: PointerInput = { type: 'down', x: 10, y: 5, timestamp: 0 };
    const up: PointerInput = { type: 'up', x: 10, y: 5, timestamp: 100 };
    renderer.handlePointerInput({ type: 'move', x: 5, y: 5, timestamp: 0 });
    renderer.handlePointerInput(down);
    renderer.handlePointerInput(up);

    const hover = events.find(e => e.eventType === EventType.HOVER);
    expect(hover).toBeDefined();
    expect(hover.nodeId).toBe(2);
    expect(hover.data.isHovering).toBe(true);

    const click = events.find(e => e.eventType === EventType.CLICK);
    expect(click).toBeDefined();
    expect(click.nodeId).toBe(2);
  });

  it('recognizes a drag gesture lifecycle', () => {
    const { renderer } = makeRenderer([
      stack(ComponentType.VSTACK, 1),
      text('Box', 2),
      insert(1, 2, 0),
      insert(0, 1, 0),
    ]);
    renderer.executeCommands([
      { opcode: 'ATTACH_GESTURE', nodeId: 2, gestureType: GestureType.DRAG, gestureRecognizerId: 1 },
    ]);
    const gestures: any[] = [];
    renderer.setupEvents(() => {});
    renderer.setupGestures((nodeId, gestureType, gestureState, data) =>
      gestures.push({ nodeId, gestureType, gestureState, data })
    );

    renderer.handlePointerInput({ type: 'down', x: 10, y: 10, timestamp: 0 });
    renderer.handlePointerInput({ type: 'move', x: 40, y: 50, timestamp: 16 });
    expect(gestures[0]).toMatchObject({ nodeId: 2, gestureType: GestureType.DRAG, gestureState: GestureState.BEGAN });

    renderer.handlePointerInput({ type: 'move', x: 50, y: 60, timestamp: 32 });
    expect(gestures[1]).toMatchObject({ gestureType: GestureType.DRAG, gestureState: GestureState.CHANGED });

    renderer.handlePointerInput({ type: 'up', x: 50, y: 60, timestamp: 40 });
    expect(gestures[gestures.length - 1]).toMatchObject({ gestureType: GestureType.DRAG, gestureState: GestureState.ENDED });
  });
});
