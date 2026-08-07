/**
 * @pathland/renderer-dom
 *
 * Tests for the DOMRenderer event dispatch (click, long-press, hover,
 * focus/blur, keyboard) using jsdom.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DOMRenderer } from './index';
import { ComponentType, TextProperty, EventType } from '@pathland/protocol';
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
    renderer = await DOMRenderer.createJSDOMRenderer();
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
