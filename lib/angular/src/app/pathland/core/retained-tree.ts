import { signal } from '@angular/core';
import { CATEGORY, META, TREE, STYLE, VALUE_TYPE } from './protocol';
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

/** The renderer's retained tree: applies `TREE`/`STYLE`/`META` opcodes in place. */
export class RetainedTree {
  private readonly nodes = new Map<number, PathlandNode>();

  /** Design-token overrides (`path → { valueType, value }`) from `STYLE::SET_DESIGN_TOKEN`. */
  readonly tokens = signal<Map<string, { valueType: number; value: number }>>(new Map());

  /** The viewport applied via `META::ENVIRONMENT` (logical points), or null. */
  readonly viewport = signal<{ width: number; height: number } | null>(null);

  /** Renderer-owned default token values (the renderer owns the defaults). */
  private static readonly DEFAULTS: Record<string, number> = {
    'color.primary': 0xff2196f3,
    'color.secondary': 0xff757575,
    'color.background': 0xffffffff,
    'color.surface': 0xffffffff,
    'color.text.primary': 0xff000000,
    'color.text.secondary': 0xff757575,
    'color.border': 0xffe0e0e0,
    'color.shadow': 0x33000000,
    'font.body.size': 14,
    'font.body.weight': 400,
    'space.xs': 4,
    'space.sm': 8,
    'space.md': 12,
    'space.lg': 16,
    'space.xl': 24,
  };

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

  /**
   * Resolve a design token: application override → renderer default → parent
   * path → undefined (spec/OPCODE.md §Design Token System).
   */
  token(path: string): number | undefined {
    const override = this.tokens().get(path);
    if (override !== undefined) {
      return override.valueType === VALUE_TYPE.F32 ? floatFromBits(override.value) : override.value;
    }
    if (path in RetainedTree.DEFAULTS) {
      return RetainedTree.DEFAULTS[path];
    }
    const dot = path.lastIndexOf('.');
    return dot > 0 ? this.token(path.slice(0, dot)) : undefined;
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
        case CATEGORY.META:
          this.applyMeta(op.command, op);
          break;
        default:
          break;
      }
    }
  }

  private applyMeta(command: number, op: { a: number; b: number }): void {
    if (command === META.RESET) {
      this.nodes.clear();
      this.tokens.set(new Map());
      this.viewport.set(null);
      return;
    }
    if (command === META.ENVIRONMENT) {
      this.viewport.set({ width: floatFromBits(op.a), height: floatFromBits(op.b) });
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
    if (command === STYLE.SET_DESIGN_TOKEN) {
      // A = arena/string offset of the token path, B = valueType (u8), C = value.
      this.tokens.update((m) => new Map(m).set(frame.stringAt(op.a), { valueType: op.b, value: op.c }));
      return;
    }
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