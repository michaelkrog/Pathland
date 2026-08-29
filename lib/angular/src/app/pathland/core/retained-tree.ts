import { signal } from '@angular/core';
import { CATEGORY, TREE, STYLE, VALUE_TYPE } from './protocol';
import { Frame } from './frame';

/**
 * A node in the renderer's retained tree — the renderer's own cache of its
 * output (Principle 1: renderers are pure functions of the opcode stream; this
 * map is their retained rendered-output tree, never application state).
 *
 * Mutable fields are Angular signals so frame deltas re-render only the
 * affected nodes (ngui is signal-driven and zoneless).
 */
export class PathlandNode {
  readonly component: number;
  /** Text set via `STYLE::SET_TEXT`. */
  readonly text = signal<string | null>(null);
  /** Raw wire values (`propertyId → bits`) for non-STRING properties. */
  readonly props = signal<Map<number, number>>(new Map());
  /** Resolved `STRING`-typed properties (`propertyId → text`). */
  readonly strings = signal<Map<number, string>>(new Map());
  /** Date value applied via `STYLE::SET_DATE` (`B`=days, `C`=millis of day). */
  readonly date = signal<{ days: number; millis: number } | null>(null);
  /** Child node ids in insertion order. */
  readonly children = signal<number[]>([]);

  constructor(
    readonly id: number,
    component: number,
  ) {
    this.component = component;
  }

  /** An `f32` property value, or `undefined` when absent. */
  f32(prop: number): number | undefined {
    const bits = this.props().get(prop);
    return bits === undefined ? undefined : floatFromBits(bits);
  }

  /** A `COLOR`-typed property's raw `0xAARRGGBB` bits, or `undefined`. */
  color(prop: number): number | undefined {
    return this.props().get(prop);
  }
}

/** The renderer's retained tree: applies `TREE`/`STYLE` opcodes in place. */
export class RetainedTree {
  private readonly nodes = new Map<number, PathlandNode>();

  /** The first node created (id 1 for the Java emitter). */
  get rootId(): number | null {
    return this.nodes.has(1) ? 1 : null;
  }

  node(id: number): PathlandNode | undefined {
    return this.nodes.get(id);
  }

  has(id: number): boolean {
    return this.nodes.has(id);
  }

  /** Apply a self-contained frame, mutating the retained tree. */
  applyFrame(frame: Frame): void {
    for (const op of frame.opcodes) {
      switch (op.category) {
        case CATEGORY.TREE:
          this.applyTree(op.command, op);
          break;
        case CATEGORY.STYLE:
          this.applyStyle(op.command, op, frame);
          break;
        default:
          break;
      }
    }
  }

  private applyTree(command: number, op: { a: number; b: number; c: number }): void {
    switch (command) {
      case TREE.CREATE_NODE:
        this.nodes.set(op.a, new PathlandNode(op.a, op.b & 0xffff));
        break;
      case TREE.DELETE_NODE:
        this.nodes.delete(op.a);
        break;
      case TREE.INSERT_CHILD: {
        const parent = this.nodes.get(op.a);
        if (parent) {
          parent.children.update((kids) => [...kids, op.b]);
        }
        break;
      }
      case TREE.REMOVE_CHILD: {
        const parent = this.nodes.get(op.a);
        if (parent) {
          parent.children.update((kids) => kids.filter((k) => k !== op.b));
        }
        break;
      }
      case TREE.MOVE_CHILD: {
        const parent = this.nodes.get(op.a);
        if (parent) {
          parent.children.update((kids) => {
            const next = kids.filter((k) => k !== op.b);
            const index = Math.min(op.c, next.length);
            next.splice(index, 0, op.b);
            return next;
          });
        }
        break;
      }
    }
  }

  private applyStyle(command: number, op: { a: number; b: number; c: number }, frame: Frame): void {
    if (command === STYLE.SET_TEXT) {
      const node = this.nodes.get(op.a);
      if (node) {
        node.text.set(frame.stringAt(op.b));
      }
      return;
    }
    if (command === STYLE.SET_DATE) {
      const node = this.nodes.get(op.a);
      if (node) {
        node.date.set({ days: op.b, millis: op.c });
      }
      return;
    }
    if (command !== STYLE.SET_PROPERTY) {
      return;
    }
    const node = this.nodes.get(op.a);
    if (!node) {
      return;
    }
    const property = op.b & 0xffff;
    const valueType = (op.b >>> 16) & 0xff;
    if (valueType === VALUE_TYPE.STRING) {
      node.strings.update((m) => new Map(m).set(property, frame.stringAt(op.c)));
    } else {
      node.props.update((m) => new Map(m).set(property, op.c));
    }
  }
}

/** Reinterpret raw `f32` bits as a JS number. */
export function floatFromBits(bits: number): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setUint32(0, bits, true);
  return view.getFloat32(0, true);
}

/** The retained tree provided to the renderer components. */
export function createRetainedTree(): RetainedTree {
  return new RetainedTree();
}