import { Injectable, signal } from '@angular/core';
import { RetainedTree } from '../core/retained-tree';
import { decodeFrame } from '../core/decoder';
import { eventRouter } from '../core/event-encoder';

/**
 * The Angular renderer's host connection: opens the Pathland `/ws` socket,
 * applies each self-contained frame to the retained tree (the renderer's own
 * cache), and routes raw-input events back through the same binary channel.
 *
 * A fresh session (no SSR pre-step) receives the full mount frame because the
 * server replays frames emitted before the connection attaches.
 */
@Injectable({ providedIn: 'root' })
export class PathlandSession {
  readonly tree = new RetainedTree();
  readonly rootId = signal<number | null>(null);
  readonly connected = signal(false);

  private ws: WebSocket | null = null;

  /** Connect to the renderer socket at `/<ws>` on the current host. */
  connect(): void {
    if (this.ws) {
      return;
    }
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/ws`);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => this.connected.set(true);
    ws.onclose = () => {
      this.connected.set(false);
      this.ws = null;
    };
    ws.onmessage = (event) => this.onFrame(event.data as ArrayBuffer);
    this.ws = ws;
  }

  /** Route a tap: a raw pointer-up for the node. */
  sendPointerUp(target: number): void {
    this.ws?.send(eventRouter.pointerUp(target));
  }

  /** Route a pointer-down (press/drag basis) for the node. */
  sendPointerDown(target: number, x: number, y: number): void {
    this.ws?.send(eventRouter.pointerDown(target, x, y));
  }

  /** Route a pointer move / hover enter / hover leave for the node. */
  sendPointerMove(target: number, x: number, y: number, flags = 0): void {
    this.ws?.send(eventRouter.pointerMove(target, x, y, flags));
  }

  /** Route a key press on the focused node. */
  sendKeyDown(target: number, keyCode: number, modifiers: number, flags = 0): void {
    this.ws?.send(eventRouter.keyDown(target, keyCode, modifiers, flags));
  }

  /** Route a key release on the focused node. */
  sendKeyUp(target: number, keyCode: number, modifiers: number): void {
    this.ws?.send(eventRouter.keyUp(target, keyCode, modifiers));
  }

  /** Route a focus change for the node. */
  sendFocusChanged(target: number, focused: boolean): void {
    this.ws?.send(eventRouter.focusChanged(target, focused));
  }

  /** Route an editing-session change for the node. */
  sendEditingChanged(target: number, editing: boolean): void {
    this.ws?.send(eventRouter.editingChanged(target, editing));
  }

  /** Route a field submit (commit). */
  sendSubmit(target: number): void {
    this.ws?.send(eventRouter.submit(target));
  }

  /** Route a scroll offset for a scroll view. */
  sendScroll(target: number, offsetX: number, offsetY: number): void {
    this.ws?.send(eventRouter.scroll(target, offsetX, offsetY));
  }

  /** Route a raw wheel/trackpad delta. */
  sendWheel(target: number, deltaX: number, deltaY: number): void {
    this.ws?.send(eventRouter.wheel(target, deltaX, deltaY));
  }

  /** Route a text-field value change. */
  sendTextChanged(target: number, text: string): void {
    this.ws?.send(eventRouter.textChanged(target, text));
  }

  /** Route a value control's value change. */
  sendValueChanged(target: number, value: number): void {
    this.ws?.send(eventRouter.valueChanged(target, value));
  }

  /** Route a value control's change carrying a raw 32-bit payload (e.g. a packed color). */
  sendValueBits(target: number, bits: number): void {
    this.ws?.send(eventRouter.valueBits(target, bits));
  }

  /** Route a date picker's change (days since epoch + millis of day). */
  sendDateChanged(target: number, days: number, millis: number): void {
    this.ws?.send(eventRouter.dateChanged(target, days, millis));
  }

  private onFrame(buffer: ArrayBuffer): void {
    const frame = decodeFrame(new Uint8Array(buffer));
    this.tree.applyFrame(frame);
    if (this.rootId() === null && this.tree.rootId !== null) {
      this.rootId.set(this.tree.rootId);
    }
  }
}