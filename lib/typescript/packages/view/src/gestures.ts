/**
 * @pathland/view - Gestures
 *
 * SwiftUI-inspired gesture builders. Attach a gesture to a ViewNode with
 * `.gesture(DragGesture().onChanged(...).onEnded(...))`.
 *
 * The renderer recognizes the gesture and dispatches lifecycle updates
 * (began/changed/ended/cancelled) with the protocol's gesture payload.
 */

import { GestureType } from '@pathland/protocol';

/** The value object passed to gesture handlers (protocol gesture payload). */
export type GestureValue = Record<string, number | boolean>;

/** State handlers for a lifecycle gesture. */
export interface GestureHandlers {
  onBegan?: (value: GestureValue) => void;
  onChanged?: (value: GestureValue) => void;
  onEnded?: (value: GestureValue) => void;
  onCancelled?: (value: GestureValue) => void;
}

/**
 * A lifecycle gesture: a gesture type plus optional per-state handlers.
 * Handlers are registered via the chainable onBegan/onChanged/onEnded/onCancelled.
 */
export class Gesture {
  readonly gestureType: number;
  readonly minimumDuration?: number;
  readonly minimumDistance?: number;
  handlers: GestureHandlers = {};

  constructor(gestureType: number, options?: { minimumDuration?: number; minimumDistance?: number }) {
    this.gestureType = gestureType;
    this.minimumDuration = options?.minimumDuration;
    this.minimumDistance = options?.minimumDistance;
  }

  onBegan(handler: (value: GestureValue) => void): this {
    this.handlers.onBegan = handler;
    return this;
  }

  onChanged(handler: (value: GestureValue) => void): this {
    this.handlers.onChanged = handler;
    return this;
  }

  onEnded(handler: (value: GestureValue) => void): this {
    this.handlers.onEnded = handler;
    return this;
  }

  onCancelled(handler: (value: GestureValue) => void): this {
    this.handlers.onCancelled = handler;
    return this;
  }
}

/** A tap gesture: `TapGesture().onEnded { value in ... }` */
export function TapGesture(): Gesture {
  return new Gesture(GestureType.TAP);
}

/** A long-press gesture: `LongPressGesture(minimumDuration: 0.5)` */
export function LongPressGesture(minimumDuration?: number): Gesture {
  return new Gesture(GestureType.LONG_PRESS, { minimumDuration });
}

/** A drag gesture: `DragGesture().onChanged { value in ... }.onEnded { value in ... }` */
export function DragGesture(minimumDistance?: number): Gesture {
  return new Gesture(GestureType.DRAG, { minimumDistance });
}
