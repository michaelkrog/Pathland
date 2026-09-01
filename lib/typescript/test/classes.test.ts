import { describe, expect, it } from "vitest";
import { alignmentCss, applyEnabled, applyStyleProperty, sizeCss } from "../src/classes";
import {
  ALIGN_CENTER,
  ALIGN_LEADING,
  ALIGN_TRAILING,
  PROP_BACKGROUND_COLOR,
  PROP_OPACITY,
  PROP_SPACING,
} from "../src/constants";
import { bitsFromF32 } from "../src/format";

describe("Option A style appliers", () => {
  it("spacing -> gap", () => {
    const el = document.createElement("div");
    applyStyleProperty(el, PROP_SPACING, bitsFromF32(13));
    expect(el.style.gap).toBe("13px");
  });

  it("opacity -> inline opacity", () => {
    const el = document.createElement("div");
    applyStyleProperty(el, PROP_OPACITY, bitsFromF32(0.5));
    expect(el.style.opacity).toBe("0.5");
  });

  it("background color -> rgba", () => {
    const el = document.createElement("div");
    applyStyleProperty(el, PROP_BACKGROUND_COLOR, 0x80ff0000);
    expect(el.style.backgroundColor).toBe("rgba(255, 0, 0, 0.502)");
  });

  it("width FILL -> 100%, HUG -> fit-content, fixed -> px", () => {
    expect(sizeCss(bitsFromF32(-1))).toBe("100%");
    expect(sizeCss(bitsFromF32(-2))).toBe("fit-content");
    expect(sizeCss(bitsFromF32(320))).toBe("320px");
  });

  it("alignment maps the protocol enum to CSS", () => {
    expect(alignmentCss(ALIGN_LEADING)).toBe("flex-start");
    expect(alignmentCss(ALIGN_CENTER)).toBe("center");
    expect(alignmentCss(ALIGN_TRAILING)).toBe("flex-end");
  });

  it("disabled toggles native controls + aria-disabled on other elements", () => {
    const button = document.createElement("button");
    applyEnabled(button, 0);
    expect(button.disabled).toBe(true);
    const div = document.createElement("div");
    applyEnabled(div, 0);
    expect(div.getAttribute("aria-disabled")).toBe("true");
    applyEnabled(div, 1);
    expect(div.hasAttribute("aria-disabled")).toBe(false);
  });
});