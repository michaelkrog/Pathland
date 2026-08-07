/**
 * @pathland/renderer - PointerInteraction
 *
 * Input-agnostic pointer interaction recognizer.
 *
 * Consumes a normalized pointer stream (down/move/up/cancel, in logical
 * points) and produces:
 *   - gesture lifecycle updates (tap, long-press, drag -> began/changed/
 *     ended/cancelled) with the protocol's GESTURE_UPDATE payloads
 *   - optionally synthesized click and hover events from the stream
 *
 * Renderers supply a hit-test (pointer input -> nodeId) and the set of
 * gestures attached to each node; a native/canvas/DOM input adapter feeds
 * the normalized pointer inputs. The recognizer itself is identical across
 * all renderers.
 */

import { GestureType, GestureState } from '@pathland/protocol';
import type { EventData } from '@pathland/protocol';

export type PointerInputType = 'down' | 'move' | 'up' | 'cancel';

/**
 * A normalized pointer input, in logical points. `target` optionally carries
 * the raw platform target (e.g. a DOM element) so renderers can hit-test
 * directly from it; point-based renderers use `x`/`y`.
 */
export interface PointerInput {
  type: PointerInputType;
  x: number;
  y: number;
  timestamp: number;
  /** Optional raw platform target (e.g. the DOM event target). */
  target?: unknown;
}

export interface PointerInteractionOptions {
  /** Map a pointer input to a nodeId, or null if it hits no node. */
  hitTest: (input: PointerInput) => number | null;
  /** The set of gestures attached to a node (undefined = none). */
  attachedGestures: (nodeId: number) => Set<number> | undefined;
  /** Dispatch a gesture lifecycle update. */
  onGesture: (nodeId: number, gestureType: number, gestureState: number, data?: EventData) => void;
  /** Optional: synthesize CLICK from the pointer stream (canvas-style renderers). */
  onClick?: (nodeId: number, data: EventData) => void;
  /** Optional: synthesize HOVER enter/leave from the pointer stream. */
  onHover?: (nodeId: number, isHovering: boolean, data: EventData) => void;

  /** Long-press duration in seconds. Default 0.5. */
  longPressDuration?: number;
  /** Movement tolerance (px) that cancels a long-press or a tap. Default 10. */
  moveTolerance?: number;
  /** Movement (px) before a drag begins. Default 3. */
  minDragDistance?: number;
}

interface PointerSession {
  nodeId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  prevX: number;
  prevY: number;
  prevTime: number;
  dragActive: boolean;
  longPressActive: boolean;
  longPressTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Recognizes gestures and (optionally) click/hover from a normalized pointer
 * stream. State is reset on cancel/up.
 */
export class PointerInteraction {
  private options: PointerInteractionOptions;
  private session: PointerSession | null = null;
  private hoveredNodeId: number | null = null;

  constructor(options: PointerInteractionOptions) {
    this.options = options;
  }

  /** Feed a normalized pointer input. */
  handle(input: PointerInput): void {
    switch (input.type) {
      case 'down': this.begin(input); break;
      case 'move': this.move(input); break;
      case 'up': this.end(input); break;
      case 'cancel': this.cancel(); break;
    }
  }

  /** Abort the current session (e.g. pointer left the surface). */
  cancel(): void {
    const s = this.session;
    if (s) {
      const emit = this.options.onGesture;
      if (s.dragActive) {
        emit(s.nodeId, GestureType.DRAG, GestureState.CANCELLED, {
          startX: s.startX,
          startY: s.startY,
          locationX: s.lastX,
          locationY: s.lastY,
          translationX: s.lastX - s.startX,
          translationY: s.lastY - s.startY,
        });
      } else if (s.longPressActive) {
        emit(s.nodeId, GestureType.LONG_PRESS, GestureState.CANCELLED, {
          startX: s.startX,
          startY: s.startY,
          locationX: s.lastX,
          locationY: s.lastY,
          duration: this.options.longPressDuration ?? 0.5,
        });
      }
      if (s.longPressTimer) clearTimeout(s.longPressTimer);
      this.session = null;
    }
    if (this.hoveredNodeId !== null) {
      this.options.onHover?.(this.hoveredNodeId, false, { isHovering: false });
      this.hoveredNodeId = null;
    }
  }

  private begin(input: PointerInput): void {
    const nodeId = this.options.hitTest(input);
    if (nodeId === null) return;
    const types = this.options.attachedGestures(nodeId);
    const wantsClick = !!this.options.onClick;
    if ((!types || types.size === 0) && !wantsClick) return;

    const s: PointerSession = {
      nodeId,
      startX: input.x,
      startY: input.y,
      lastX: input.x,
      lastY: input.y,
      prevX: input.x,
      prevY: input.y,
      prevTime: input.timestamp,
      dragActive: false,
      longPressActive: false,
      longPressTimer: null,
    };
    this.session = s;

    const emit = this.options.onGesture;
    if (types?.has(GestureType.TAP)) {
      emit(nodeId, GestureType.TAP, GestureState.BEGAN, { startX: input.x, startY: input.y });
    }
    if (types?.has(GestureType.LONG_PRESS)) {
      s.longPressTimer = setTimeout(() => {
        if (this.session === s) {
          s.longPressActive = true;
          emit(s.nodeId, GestureType.LONG_PRESS, GestureState.BEGAN, { startX: s.startX, startY: s.startY });
        }
      }, (this.options.longPressDuration ?? 0.5) * 1000);
    }
  }

  private move(input: PointerInput): void {
    // Hover synthesis from the pointer stream (if requested).
    if (this.options.onHover) {
      const hovered = this.options.hitTest(input);
      if (hovered !== null && hovered !== this.hoveredNodeId) {
        if (this.hoveredNodeId !== null) {
          this.options.onHover(this.hoveredNodeId, false, { isHovering: false, x: input.x, y: input.y });
        }
        this.hoveredNodeId = hovered;
        this.options.onHover(hovered, true, { isHovering: true, x: input.x, y: input.y });
      } else if (hovered === null && this.hoveredNodeId !== null) {
        this.options.onHover(this.hoveredNodeId, false, { isHovering: false, x: input.x, y: input.y });
        this.hoveredNodeId = null;
      }
    }

    const s = this.session;
    if (!s) return;

    const dt = Math.max(input.timestamp - s.prevTime, 1);
    const velocityX = ((input.x - s.prevX) / dt) * 1000;
    const velocityY = ((input.y - s.prevY) / dt) * 1000;
    s.prevX = input.x;
    s.prevY = input.y;
    s.prevTime = input.timestamp;
    s.lastX = input.x;
    s.lastY = input.y;

    const dx = s.lastX - s.startX;
    const dy = s.lastY - s.startY;
    const emit = this.options.onGesture;
    const minDrag = this.options.minDragDistance ?? 3;

    if (
      !s.dragActive &&
      this.options.attachedGestures(s.nodeId)?.has(GestureType.DRAG) &&
      (Math.abs(dx) > minDrag || Math.abs(dy) > minDrag)
    ) {
      if (s.longPressTimer) {
        clearTimeout(s.longPressTimer);
        s.longPressTimer = null;
      }
      s.dragActive = true;
      emit(s.nodeId, GestureType.DRAG, GestureState.BEGAN, { startX: s.startX, startY: s.startY });
      return;
    }

    if (s.dragActive) {
      emit(s.nodeId, GestureType.DRAG, GestureState.CHANGED, {
        startX: s.startX,
        startY: s.startY,
        locationX: s.lastX,
        locationY: s.lastY,
        translationX: dx,
        translationY: dy,
        velocityX,
        velocityY,
      });
      return;
    }

    const tolerance = this.options.moveTolerance ?? 10;
    if (!s.longPressActive && s.longPressTimer && (Math.abs(dx) > tolerance || Math.abs(dy) > tolerance)) {
      clearTimeout(s.longPressTimer);
      s.longPressTimer = null;
    }
  }

  private end(input: PointerInput): void {
    const s = this.session;
    if (!s) return;

    const emit = this.options.onGesture;
    const tolerance = this.options.moveTolerance ?? 10;

    if (s.dragActive) {
      emit(s.nodeId, GestureType.DRAG, GestureState.ENDED, {
        startX: s.startX,
        startY: s.startY,
        locationX: s.lastX,
        locationY: s.lastY,
        translationX: s.lastX - s.startX,
        translationY: s.lastY - s.startY,
        velocityX: 0,
        velocityY: 0,
      });
    } else if (s.longPressActive) {
      emit(s.nodeId, GestureType.LONG_PRESS, GestureState.ENDED, {
        startX: s.startX,
        startY: s.startY,
        locationX: s.lastX,
        locationY: s.lastY,
        duration: this.options.longPressDuration ?? 0.5,
        pressure: 1,
      });
    } else if (this.options.attachedGestures(s.nodeId)?.has(GestureType.TAP)) {
      const moved = Math.abs(s.lastX - s.startX) + Math.abs(s.lastY - s.startY);
      if (moved <= tolerance) {
        emit(s.nodeId, GestureType.TAP, GestureState.ENDED, {
          startX: s.startX,
          startY: s.startY,
          locationX: s.lastX,
          locationY: s.lastY,
          tapCount: 1,
        });
      }
    }

    // Synthesize a click for point-based renderers (down+up without movement).
    if (this.options.onClick) {
      const moved = Math.abs(s.lastX - s.startX) + Math.abs(s.lastY - s.startY);
      if (moved <= tolerance) {
        this.options.onClick(s.nodeId, { x: input.x, y: input.y });
      }
    }

    if (s.longPressTimer) clearTimeout(s.longPressTimer);
    this.session = null;
  }
}
