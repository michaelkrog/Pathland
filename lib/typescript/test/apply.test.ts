import { describe, expect, it } from "vitest";
import { applyBatch, setNodeText, type DomRenderer } from "../src/apply";
import { parseBatch } from "../src/plpl";
import {
  CAT_STYLE,
  CAT_TREE,
  CMD_CREATE_NODE,
  CMD_INSERT_CHILD,
  CMD_MOVE_CHILD,
  CMD_SET_TEXT,
  COMPONENT_BUTTON,
  COMPONENT_TEXT,
  COMPONENT_VSTACK,
  PROP_SELECTED,
  PROP_VALUE,
} from "../src/constants";
import { buildBatch, stringEntry } from "./plpl.test";

function renderer(): DomRenderer {
  return { byId: new Map<number, Node>() };
}

describe("applyBatch · STYLE", () => {
  it("applies SET_TEXT to a hydrated span", () => {
    const span = document.createElement("span");
    span.setAttribute("data-pathland-id", "1");
    const r = renderer();
    r.byId.set(1, span);
    const batch = parseBatch(buildBatch([[CAT_STYLE, CMD_SET_TEXT, 0, 1, 0, 0]], stringEntry("hi!")));
    applyBatch(batch, r);
    expect(span.textContent).toBe("hi!");
  });

  it("applies SET_TEXT to a text field's input", () => {
    const tf = document.createElement("label");
    tf.className = "pathland-textfield";
    const input = document.createElement("input");
    input.type = "text";
    tf.appendChild(input);
    const r = renderer();
    r.byId.set(5, tf);
    applyBatch(parseBatch(buildBatch([[CAT_STYLE, CMD_SET_TEXT, 0, 5, 0, 0]], stringEntry("ab"))), r);
    expect(input.value).toBe("ab");
  });

  it("applies SELECTED to a toggle checkbox", () => {
    const toggle = document.createElement("label");
    toggle.className = "pathland-toggle";
    const box = document.createElement("input");
    box.type = "checkbox";
    toggle.appendChild(box);
    const r = renderer();
    r.byId.set(4, toggle);
    applyBatch(parseBatch(buildBatch([[CAT_STYLE, 1, 0, 4, (0 << 16) | PROP_SELECTED, 1]])), r);
    expect(box.checked).toBe(true);
  });

  it("applies VALUE to a slider", () => {
    const slider = document.createElement("label");
    slider.className = "pathland-slider";
    const range = document.createElement("input");
    range.type = "range";
    slider.appendChild(range);
    const r = renderer();
    r.byId.set(6, slider);
    const bits = new Uint32Array(new Float32Array([0.75]).buffer)[0]!;
    applyBatch(parseBatch(buildBatch([[CAT_STYLE, 1, 0, 6, (0 << 16) | PROP_VALUE, bits]])), r);
    expect(range.value).toBe("0.75");
  });
});

describe("applyBatch · TREE", () => {
  it("builds a stack: create nodes, insert, then set text", () => {
    const r = renderer();
    const batch = parseBatch(
      buildBatch(
        [
          [CAT_TREE, CMD_CREATE_NODE, 0, 1, COMPONENT_VSTACK],
          [CAT_TREE, CMD_CREATE_NODE, 0, 2, COMPONENT_TEXT],
          [CAT_TREE, CMD_INSERT_CHILD, 0, 1, 2],
          [CAT_STYLE, CMD_SET_TEXT, 0, 2, 0],
        ],
        stringEntry("x"),
      ),
    );
    applyBatch(batch, r);
    const stack = r.byId.get(1) as HTMLElement;
    expect(stack).toBeInstanceOf(HTMLDivElement);
    expect(stack.style.display).toBe("flex");
    expect(stack.style.flexDirection).toBe("column");
    expect(r.byId.get(2)?.textContent).toBe("x");
    expect(stack.children).toHaveLength(1);
    expect(stack.firstElementChild?.getAttribute("data-pathland-id")).toBe("2");
  });

  it("removes a node from the DOM", () => {
    const root = document.createElement("div");
    const button = document.createElement("button");
    button.setAttribute("data-pathland-id", "9");
    root.appendChild(button);
    const r = renderer();
    r.byId.set(9, button);
    applyBatch(parseBatch(buildBatch([[CAT_TREE, 2, 0, 9, 0, 0]])), r);
    expect(root.childNodes).toHaveLength(0);
    expect(r.byId.has(9)).toBe(false);
  });

  it("inserts children at the requested index", () => {
    const r = renderer();
    const batch = parseBatch(
      buildBatch([
        [CAT_TREE, CMD_CREATE_NODE, 0, 1, COMPONENT_VSTACK],
        [CAT_TREE, CMD_CREATE_NODE, 0, 2, COMPONENT_BUTTON],
        [CAT_TREE, CMD_CREATE_NODE, 0, 3, COMPONENT_TEXT],
        [CAT_TREE, CMD_INSERT_CHILD, 0, 1, 3],
        [CAT_TREE, CMD_INSERT_CHILD, 0, 1, 2, 0],
      ]),
    );
    applyBatch(batch, r);
    const stack = r.byId.get(1) as HTMLElement;
    expect(stack.children[0]?.getAttribute("data-pathland-id")).toBe("2");
    expect(stack.children[1]?.getAttribute("data-pathland-id")).toBe("3");
  });

  it("moves a child to a new index", () => {
    const r = renderer();
    const batch = parseBatch(
      buildBatch([
        [CAT_TREE, CMD_CREATE_NODE, 0, 1, COMPONENT_VSTACK],
        [CAT_TREE, CMD_CREATE_NODE, 0, 2, COMPONENT_TEXT],
        [CAT_TREE, CMD_CREATE_NODE, 0, 3, COMPONENT_TEXT],
        [CAT_TREE, CMD_INSERT_CHILD, 0, 1, 2],
        [CAT_TREE, CMD_INSERT_CHILD, 0, 1, 3],
        [CAT_TREE, CMD_MOVE_CHILD, 0, 1, 2, 1],
      ]),
    );
    applyBatch(batch, r);
    const stack = r.byId.get(1) as HTMLElement;
    expect(stack.children[0]?.getAttribute("data-pathland-id")).toBe("3");
    expect(stack.children[1]?.getAttribute("data-pathland-id")).toBe("2");
  });
});

describe("setNodeText", () => {
  it("writes through to the composite's label span", () => {
    const slider = document.createElement("label");
    slider.className = "pathland-slider";
    const input = document.createElement("input");
    input.type = "range";
    const span = document.createElement("span");
    span.className = "pathland-text";
    slider.append(input, span);
    setNodeText(slider, "50%");
    expect(span.textContent).toBe("50%");
  });
});