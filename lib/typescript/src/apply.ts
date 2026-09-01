// Delta application: decode each opcode and apply it to the DOM via the
// retained `id → Node` registry. STYLE deltas mutate the hydrated element in
// place; TREE deltas build the element shell and insert/remove/move it; META
// deltas reset/environment.

import {
  CAT_META,
  CAT_STYLE,
  CAT_TREE,
  CMD_CREATE_NODE,
  CMD_DELETE_NODE,
  CMD_ENVIRONMENT,
  CMD_INSERT_CHILD,
  CMD_MOVE_CHILD,
  CMD_REMOVE_CHILD,
  CMD_RESET,
  CMD_SET_DATE,
  CMD_SET_DESIGN_TOKEN,
  CMD_SET_PROPERTY,
  CMD_SET_TEXT,
  PROP_BINDING_ID,
  PROP_COLOR_VALUE,
  PROP_ENABLED,
  PROP_FONT_FAMILY,
  PROP_IMAGE_SOURCE,
  PROP_LABEL,
  PROP_PROMPT,
  PROP_SELECTED,
  PROP_SELECTION,
  PROP_TEXT,
  PROP_VALUE,
  VAL_STRING,
} from "./constants";
import type { Batch, Opcode } from "./plpl";
import { readString } from "./plpl";
import { childrenContainer, createElement } from "./elements";
import { applyEnabled, applyProperty } from "./classes";
import { createTokenSink, applyDesignToken, type DesignTokenSink } from "./tokens";
import { argbToHex, daysToIso, f32FromBits, millisToTime } from "./format";

/** The retained `node id → DOM Node` registry the renderer works against. */
export interface DomRenderer {
  byId: Map<number, Node>;
  /** Optional design-token sink (defaults to document-root CSS variables). */
  tokenSink?: DesignTokenSink;
}

/** Apply every opcode in a batch to the DOM (TREE structure + STYLE/META deltas). */
export function applyBatch(batch: Batch, renderer: DomRenderer): void {
  for (const op of batch.opcodes) {
    switch (op.category) {
      case CAT_TREE:
        applyTree(op, renderer);
        break;
      case CAT_STYLE:
        applyStyle(op, batch.strings, renderer);
        break;
      case CAT_META:
        applyMeta(op, renderer);
        break;
      default:
        break;
    }
  }
}

function applyMeta(op: Opcode, r: DomRenderer): void {
  switch (op.command) {
    case CMD_RESET: {
      for (const el of Array.from(r.byId.values())) {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      }
      r.byId.clear();
      break;
    }
    case CMD_ENVIRONMENT:
    default:
      break;
  }
}

function applyTree(op: Opcode, r: DomRenderer): void {
  switch (op.command) {
    case CMD_CREATE_NODE: {
      // Hydration-aware: an id already present in the registry is the SSR-hydrated
      // element — reuse it (a resync/full snapshot replays CREATE for every node
      // without clobbering the visible DOM). Only create a fresh shell when absent.
      let el = r.byId.get(op.a);
      if (!el) {
        el = createElement(op.b);
        if (el.nodeType === Node.ELEMENT_NODE) {
          (el as HTMLElement).setAttribute("data-pathland-id", String(op.a));
        }
        r.byId.set(op.a, el);
      }
      break;
    }
    case CMD_DELETE_NODE: {
      const el = r.byId.get(op.a);
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
      r.byId.delete(op.a);
      break;
    }
    case CMD_INSERT_CHILD: {
      const parent = r.byId.get(op.a);
      const child = r.byId.get(op.b);
      if (parent && child) {
        const container = childrenContainer(parent);
        // Hydration/idempotent-replay guard: skip when the child is already there
        // (the SSR DOM already holds the initial tree; a resync replays it).
        if (container && !container.contains(child)) {
          insertAt(container, child, op.c);
        }
      }
      break;
    }
    case CMD_REMOVE_CHILD: {
      const child = r.byId.get(op.b);
      if (child && child.parentNode) {
        child.parentNode.removeChild(child);
      }
      break;
    }
    case CMD_MOVE_CHILD: {
      const child = r.byId.get(op.b);
      if (!child) {
        break;
      }
      if (child.parentNode) {
        child.parentNode.removeChild(child);
      }
      const parent = r.byId.get(op.a);
      if (parent) {
        const container = childrenContainer(parent);
        if (container) {
          insertAt(container, child, op.c);
        }
      }
      break;
    }
    default:
      break;
  }
}

function insertAt(container: Node, child: Node, index: number): void {
  const visible = Array.from(container.childNodes).filter(
    (n) => n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.COMMENT_NODE,
  );
  const target = visible[index];
  if (target) {
    container.insertBefore(child, target);
  } else {
    container.appendChild(child);
  }
}

function applyStyle(op: Opcode, strings: Uint8Array, r: DomRenderer): void {
  if (op.command === CMD_SET_DESIGN_TOKEN) {
    applyDesignToken(op, strings, r.tokenSink ?? createTokenSink());
    return;
  }
  const node = r.byId.get(op.a);
  if (!node || node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  const el = node as HTMLElement;
  switch (op.command) {
    case CMD_SET_TEXT:
      setNodeText(el, readString(strings, op.b));
      break;
    case CMD_SET_DATE: {
      const input = el.matches("input[type=date],input[type=time],input[type=datetime-local]")
        ? (el as HTMLInputElement)
        : el.querySelector<HTMLInputElement>("input[type=date],input[type=time],input[type=datetime-local]");
      if (input) {
        if (input.type === "time") {
          input.value = millisToTime(op.c);
        } else if (input.type === "datetime-local") {
          const date = daysToIso(op.b);
          const time = millisToTime(op.c);
          input.value = date ? `${date}T${time}` : time;
        } else {
          input.value = daysToIso(op.b);
        }
      }
      break;
    }
    case CMD_SET_PROPERTY: {
      const propId = op.b & 0xffff;
      const valueType = (op.b >>> 16) & 0xff;
      if (valueType === VAL_STRING) {
        applyStringProperty(el, propId, readString(strings, op.c));
      } else {
        applyNumericProperty(el, propId, valueType, op.c);
      }
      break;
    }
    default:
      break;
  }
}

/** Set a node's text, honoring text fields/editors and label spans (SSR structure). */
export function setNodeText(el: HTMLElement, text: string): void {
  const input = el.querySelector("input[type=text],input[type=password]");
  if (input instanceof HTMLInputElement) {
    input.value = text;
    return;
  }
  const textarea = el.querySelector("textarea");
  if (textarea instanceof HTMLTextAreaElement) {
    textarea.value = text;
    return;
  }
  const span = el.querySelector(".pathland-text");
  if (span) {
    span.textContent = text;
    return;
  }
  el.textContent = text;
}

function applyStringProperty(el: HTMLElement, propId: number, text: string): void {
  switch (propId) {
    case PROP_TEXT:
    case PROP_LABEL: {
      const span = el.querySelector(".pathland-label");
      if (span) {
        span.textContent = text;
      } else {
        setNodeText(el, text);
      }
      break;
    }
    case PROP_PROMPT: {
      const input = el.querySelector("input[type=text]");
      if (input instanceof HTMLInputElement) {
        input.placeholder = text;
      }
      break;
    }
    case PROP_IMAGE_SOURCE: {
      const img = el.matches("img") ? el : el.querySelector("img");
      if (img instanceof HTMLImageElement) {
        img.src = text;
      }
      break;
    }
    case PROP_FONT_FAMILY: {
      el.style.fontFamily = text;
      break;
    }
    default:
      break;
  }
}

function applyNumericProperty(el: HTMLElement, propId: number, valueType: number, bits: number): void {
  switch (propId) {
    case PROP_SELECTED: {
      const input = el.querySelector<HTMLInputElement>("input[type=checkbox]");
      if (input) {
        const on = (valueType === 0x01 ? bits & 0xff : bits) !== 0;
        input.checked = on;
        if (input.getAttribute("role") === "checkbox" || input.getAttribute("role") === "switch") {
          input.setAttribute("aria-pressed", on ? "true" : "false");
        }
      }
      break;
    }
    case PROP_VALUE: {
      const range = el.querySelector<HTMLInputElement>("input[type=range]");
      if (range) {
        range.value = String(f32FromBits(bits));
      }
      const stepText = el.querySelector(".pathland-stepper span");
      if (stepText) {
        stepText.textContent = String(Math.round(f32FromBits(bits) * 100) / 100);
      }
      const gauge = el.querySelector<HTMLElement>(".pathland-gauge > div");
      if (gauge) {
        const max = Number(el.querySelector<HTMLElement>(".pathland-gauge")?.dataset.max ?? 1);
        const min = Number(el.querySelector<HTMLElement>(".pathland-gauge")?.dataset.min ?? 0);
        const span = max - min;
        const pct = span <= 0 ? 0 : ((f32FromBits(bits) - min) / span) * 100;
        gauge.style.width = pct + "%";
      }
      break;
    }
    case PROP_SELECTION: {
      const select = el.matches("select")
        ? (el as HTMLSelectElement)
        : el.querySelector<HTMLSelectElement>("select");
      if (select) {
        select.value = String(bits);
      }
      break;
    }
    case PROP_COLOR_VALUE: {
      const input = el.matches("input[type=color]")
        ? el
        : el.querySelector<HTMLInputElement>("input[type=color]");
      if (input instanceof HTMLInputElement) {
        input.value = argbToHex(bits);
      }
      break;
    }
    case PROP_BINDING_ID: {
      el.dataset.bindingId = String(bits >>> 0);
      break;
    }
    case PROP_ENABLED:
      applyEnabled(el, bits);
      break;
    default:
      applyProperty(el, propId, valueType, bits);
      break;
  }
}