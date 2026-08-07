/**
 * @pathland/renderer-dom
 *
 * Tests for the DOMRenderer event dispatch (click, long-press, hover,
 * focus/blur, keyboard) using jsdom.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DOMRenderer } from './index';
import { createJSDOMRenderer } from './jsdom';
import { ComponentType, TextProperty, EventType, GestureType, GestureState } from '@pathland/protocol';
import type { Command } from '@pathland/protocol';

type DispatchCall = [nodeId: number, eventType: number];

const COMMANDS: Command[] = [
  {
    opcode: 'CREATE_NODE',
    nodeId: 1,
    componentType: ComponentType.TEXT,
    properties: new Map([[TextProperty.TEXT, { type: 'string', value: 'Hello' }]]),
  },
  { opcode: 'INSERT_CHILD', parentId: 0, childId: 1, index: 0 },
];

describe('DOMRenderer event dispatch', () => {
  let renderer: DOMRenderer;
  let dispatched: DispatchCall[];
  let document: Document;
  let el: HTMLElement;

  beforeEach(async () => {
    renderer = await createJSDOMRenderer();
    dispatched = [];
    renderer.setupEvents((nodeId, eventType) => dispatched.push([nodeId, eventType]));
    renderer.executeCommands(COMMANDS);

    document = renderer.getDocument() as Document;
    el = renderer.getDOMElement(1) as HTMLElement;
    expect(el).toBeDefined();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('dispatches CLICK from the node element', () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dispatched).toContainEqual([1, EventType.CLICK]);
  });

  it('resolves the nearest ancestor node when the target is a child element', () => {
    const inner = document.createElement('span');
    el.appendChild(inner);
    inner.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dispatched).toContainEqual([1, EventType.CLICK]);
  });

  it('dispatches LONG_PRESS after holding the pointer down', () => {
    vi.useFakeTimers();
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
    vi.advanceTimersByTime(501);
    expect(dispatched).toContainEqual([1, EventType.LONG_PRESS]);
  });

  it('cancels LONG_PRESS when the pointer is released early', () => {
    vi.useFakeTimers();
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    vi.advanceTimersByTime(501);
    expect(dispatched).not.toContainEqual([1, EventType.LONG_PRESS]);
  });

  it('cancels LONG_PRESS when the pointer moves beyond the tolerance', () => {
    vi.useFakeTimers();
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
    el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 50, clientY: 50 }));
    vi.advanceTimersByTime(501);
    expect(dispatched).not.toContainEqual([1, EventType.LONG_PRESS]);
  });

  it('dispatches HOVER on enter and leave', () => {
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(dispatched).toContainEqual([1, EventType.HOVER]);

    el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: null }));
    expect(dispatched).toContainEqual([1, EventType.HOVER]);
  });

  it('attaches event payload data', () => {
    const events: any[] = [];
    renderer.setupEvents((nodeId, eventType, data) => events.push({ nodeId, eventType, data }));

    el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 15, clientY: 25 }));
    expect(events[0]).toMatchObject({ nodeId: 1, eventType: EventType.CLICK, data: { x: 15, y: 25 } });

    events.length = 0;
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(events[0]).toMatchObject({ nodeId: 1, eventType: EventType.HOVER, data: { isHovering: true } });

    events.length = 0;
    el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: null }));
    expect(events[0]).toMatchObject({ nodeId: 1, eventType: EventType.HOVER, data: { isHovering: false } });
  });

  it('dispatches FOCUS and BLUR', () => {
    el.focus();
    expect(dispatched).toContainEqual([1, EventType.FOCUS]);

    el.blur();
    expect(dispatched).toContainEqual([1, EventType.BLUR]);
  });

  it('dispatches KEY_DOWN and KEY_UP from a focused node', () => {
    el.focus();
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
    expect(dispatched).toContainEqual([1, EventType.KEY_DOWN]);

    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
    expect(dispatched).toContainEqual([1, EventType.KEY_UP]);
  });
});

describe('DOMRenderer tree mutation', () => {
  let renderer: DOMRenderer;
  let document: Document;

  const build = async (commands: Command[]): Promise<DOMRenderer> => {
    const r = await createJSDOMRenderer();
    r.executeCommands(commands);
    return r;
  };

  const stackCommands: Command[] = [
    { opcode: 'CREATE_NODE', nodeId: 1, componentType: ComponentType.VSTACK, properties: new Map() },
    { opcode: 'CREATE_NODE', nodeId: 2, componentType: ComponentType.TEXT, properties: new Map([[TextProperty.TEXT, { type: 'string', value: 'A' }]]) },
    { opcode: 'CREATE_NODE', nodeId: 3, componentType: ComponentType.TEXT, properties: new Map([[TextProperty.TEXT, { type: 'string', value: 'B' }]]) },
    { opcode: 'CREATE_NODE', nodeId: 4, componentType: ComponentType.TEXT, properties: new Map([[TextProperty.TEXT, { type: 'string', value: 'C' }]]) },
    { opcode: 'INSERT_CHILD', parentId: 1, childId: 2, index: 0 },
    { opcode: 'INSERT_CHILD', parentId: 1, childId: 3, index: 1 },
    { opcode: 'INSERT_CHILD', parentId: 1, childId: 4, index: 2 },
  ];

  it('MOVE_CHILD reorders children within a parent', async () => {
    renderer = await build(stackCommands);
    const stack = renderer.getDOMElement(1) as HTMLElement;

    expect(Array.from(stack.children)).toEqual([
      renderer.getDOMElement(2),
      renderer.getDOMElement(3),
      renderer.getDOMElement(4),
    ]);

    renderer.executeCommands([{ opcode: 'MOVE_CHILD', parentId: 1, childId: 4, index: 0 }]);

    expect(Array.from(stack.children)).toEqual([
      renderer.getDOMElement(4),
      renderer.getDOMElement(2),
      renderer.getDOMElement(3),
    ]);
  });

  it('MOVE_CHILD appends when the index is out of range', async () => {
    renderer = await build(stackCommands);
    const stack = renderer.getDOMElement(1) as HTMLElement;

    renderer.executeCommands([{ opcode: 'MOVE_CHILD', parentId: 1, childId: 2, index: 99 }]);

    expect(Array.from(stack.children)).toEqual([
      renderer.getDOMElement(3),
      renderer.getDOMElement(4),
      renderer.getDOMElement(2),
    ]);
  });

  it('RESET clears all rendered output except the root', async () => {
    renderer = await build(stackCommands);
    expect(renderer.getDOMElement(2)).toBeDefined();

    renderer.executeCommands([{ opcode: 'RESET' }]);

    expect(renderer.getDOMElement(2)).toBeUndefined();
    expect(renderer.getDOMElement(4)).toBeUndefined();
    expect(renderer.getDOMElement(0)).toBeDefined();
  });

  it('applies per-edge padding properties', async () => {
    renderer = await build([
      { opcode: 'CREATE_NODE', nodeId: 1, componentType: ComponentType.TEXT, properties: new Map() },
      { opcode: 'INSERT_CHILD', parentId: 0, childId: 1, index: 0 },
    ]);
    const el = renderer.getDOMElement(1) as HTMLElement;

    renderer.executeCommands([
      { opcode: 'SET_PROPERTY', nodeId: 1, propertyId: 0x1012, value: { type: 'f32', value: 8 } }, // TOP
      { opcode: 'SET_PROPERTY', nodeId: 1, propertyId: 0x1013, value: { type: 'f32', value: 16 } }, // RIGHT
      { opcode: 'SET_PROPERTY', nodeId: 1, propertyId: 0x1014, value: { type: 'f32', value: 24 } }, // BOTTOM
      { opcode: 'SET_PROPERTY', nodeId: 1, propertyId: 0x1015, value: { type: 'f32', value: 32 } }, // LEFT
    ]);

    expect(el.style.paddingTop).toBe('8px');
    expect(el.style.paddingRight).toBe('16px');
    expect(el.style.paddingBottom).toBe('24px');
    expect(el.style.paddingLeft).toBe('32px');
  });
});

describe('DOMRenderer gesture recognition', () => {
  let renderer: DOMRenderer;
  let document: Document;
  let el: HTMLElement;
  let gestures: any[];

  beforeEach(async () => {
    renderer = await createJSDOMRenderer();
    gestures = [];
    renderer.setupGestures((nodeId, gestureType, gestureState, data) =>
      gestures.push({ nodeId, gestureType, gestureState, data })
    );
    renderer.executeCommands(COMMANDS);
    document = renderer.getDocument() as Document;
    el = renderer.getDOMElement(1) as HTMLElement;
  });

  const attach = (gestureType: number) => {
    renderer.executeCommands([
      { opcode: 'ATTACH_GESTURE', nodeId: 1, gestureType, gestureRecognizerId: 1 },
    ]);
  };

  it('recognizes a drag lifecycle (began -> changed -> ended)', () => {
    attach(GestureType.DRAG);

    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
    el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 30, clientY: 40 }));
    expect(gestures[0]).toMatchObject({
      nodeId: 1,
      gestureType: GestureType.DRAG,
      gestureState: GestureState.BEGAN,
      data: { startX: 10, startY: 10 },
    });

    el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 40, clientY: 50 }));
    expect(gestures[1]).toMatchObject({
      gestureType: GestureType.DRAG,
      gestureState: GestureState.CHANGED,
      data: { translationX: 30, translationY: 40 },
    });

    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(gestures[2]).toMatchObject({
      gestureType: GestureType.DRAG,
      gestureState: GestureState.ENDED,
      data: { translationX: 30, translationY: 40 },
    });
  });

  it('cancels a drag when the pointer leaves the container', () => {
    attach(GestureType.DRAG);
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
    el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 40, clientY: 50 }));
    el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    expect(gestures[gestures.length - 1]).toMatchObject({
      gestureType: GestureType.DRAG,
      gestureState: GestureState.CANCELLED,
    });
  });

  it('recognizes a long-press lifecycle', () => {
    attach(GestureType.LONG_PRESS);
    vi.useFakeTimers();

    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
    vi.advanceTimersByTime(501);
    expect(gestures[0]).toMatchObject({
      nodeId: 1,
      gestureType: GestureType.LONG_PRESS,
      gestureState: GestureState.BEGAN,
    });

    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(gestures[1]).toMatchObject({
      gestureType: GestureType.LONG_PRESS,
      gestureState: GestureState.ENDED,
    });

    vi.useRealTimers();
  });

  it('recognizes a simple tap', () => {
    attach(GestureType.TAP);

    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
    expect(gestures[0]).toMatchObject({
      nodeId: 1,
      gestureType: GestureType.TAP,
      gestureState: GestureState.BEGAN,
    });

    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(gestures[1]).toMatchObject({
      gestureType: GestureType.TAP,
      gestureState: GestureState.ENDED,
      data: { tapCount: 1 },
    });
  });
});
