// Delta application: decode each opcode and apply it to the DOM via the
// retained `id → Node` registry. STYLE deltas mutate the hydrated element in
// place; TREE deltas build the element shell and insert/remove/move it.

import {
  CAT_STYLE,
  CAT_TREE,
  CMD_CREATE_NODE,
  CMD_DELETE_NODE,
  CMD_INSERT_CHILD,
  CMD_MOVE_CHILD,
  CMD_REMOVE_CHILD,
  CMD_SET_DATE,
  CMD_SET_PROPERTY,
  CMD_SET_TEXT,
  PROP_COLOR_VALUE,
  PROP_ENABLED,
  PROP_LABEL,
  PROP_PROMPT,
  PROP_SELECTED,
  PROP_SELECTION,
  PROP_VALUE,
  VAL_STRING,
} from "./constants";
import type { Batch, Opcode } from "./plpl";
import { readString } from "./plpl";
import { childrenContainer, createElement } from "./elements";
import { applyEnabled, applyStyleProperty } from "./classes";
import { argbToHex, daysToIso, f32FromBits } from "./format";

/** The retained `node id → DOM Node` registry the renderer works against. */
export interface DomRenderer {
  byId: Map<number, Node>;
}

/** Apply every opcode in a batch to the DOM (TREE structure + STYLE deltas). */
export function applyBatch(batch: Batch, renderer: DomRenderer): void {
  for (const op of batch.opcodes) {
    switch (op.category) {
      case CAT_TREE:
        applyTree(op, renderer);
        break;
      case CAT_STYLE:
        applyStyle(op, batch.strings, renderer);
        break;
      default:
        break;
    }
  }
}

function applyTree(op: Opcode, r: DomRenderer): void {
  switch (op.command) {
    case CMD_CREATE_NODE: {
      const el = createElement(op.b);
      if (el.nodeType === Node.ELEMENT_NODE) {
        (el as HTMLElement).setAttribute("data-pathland-id", String(op.a));
      }
      r.byId.set(op.a, el);
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
        if (container) {
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
      const input = el.matches("input[type=date]") ? el : el.querySelector("input[type=date]");
      if (input instanceof HTMLInputElement) {
        input.value = daysToIso(op.b);
      }
      break;
    }
    case CMD_SET_PROPERTY: {
      const propId = op.b & 0xffff;
      const valueType = (op.b >>> 16) & 0xff;
      if (valueType === VAL_STRING) {
        applyStringProperty(el, propId, readString(strings, op.c));
      } else {
        applyNumericProperty(el, propId, op.c);
      }
      break;
    }
    default:
      break;
  }
}

/** Set a node's text, honoring text fields/editors and label spans (SSR structure). */
export function setNodeText(el: HTMLElement, text: string): void {
  const input = el.querySelector("input[type=text]");
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
    case PROP_LABEL: {
      const span = el.querySelector(".pathland-label");
      if (span) {
        span.textContent = text;
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
    default:
      break;
  }
}

function applyNumericProperty(el: HTMLElement, propId: number, bits: number): void {
  switch (propId) {
    case PROP_SELECTED: {
      const input = el.querySelector("input[type=checkbox]");
      if (input instanceof HTMLInputElement) {
        input.checked = (bits & 0xff) !== 0;
      }
      break;
    }
    case PROP_VALUE: {
      const range = el.querySelector("input[type=range]");
      if (range instanceof HTMLInputElement) {
        range.value = String(f32FromBits(bits));
      }
      const stepText = el.querySelector(".pathland-stepper span");
      if (stepText) {
        stepText.textContent = String(Math.round(f32FromBits(bits) * 100) / 100);
      }
      break;
    }
    case PROP_SELECTION: {
      const select = el.matches("select") ? el : el.querySelector("select");
      if (select instanceof HTMLSelectElement) {
        select.value = String(bits);
      }
      break;
    }
    case PROP_COLOR_VALUE: {
      const input = el.matches("input[type=color]") ? el : el.querySelector("input[type=color]");
      if (input instanceof HTMLInputElement) {
        input.value = argbToHex(bits);
      }
      break;
    }
    case PROP_ENABLED:
      applyEnabled(el, bits);
      break;
    default:
      applyStyleProperty(el, propId, bits);
      break;
  }
}