import { describe, expect, it } from "vitest";
import { tokenCssValue, tokenToCssVar, createTokenSink } from "../src/tokens";
import { VAL_COLOR, VAL_F32, VAL_U32 } from "../src/constants";
import { bitsFromF32 } from "../src/format";

describe("design tokens", () => {
  it("maps dot paths to CSS variable names", () => {
    expect(tokenToCssVar("color.primary")).toBe("--color-primary");
    expect(tokenToCssVar("space.2")).toBe("--space-2");
    expect(tokenToCssVar("font.body")).toBe("--font-body");
  });

  it("renders COLOR values as rgba", () => {
    expect(tokenCssValue(VAL_COLOR, 0xff0000ff)).toBe("rgba(0,0,255,1.000)");
  });

  it("renders F32 values as numbers", () => {
    expect(tokenCssValue(VAL_F32, bitsFromF32(1.5))).toBe("1.5");
  });

  it("applies overrides to the document root", () => {
    const sink = createTokenSink();
    sink.setToken("color.primary", VAL_COLOR, 0xff2196f3);
    expect(document.documentElement.style.getPropertyValue("--color-primary")).toBe("rgba(33,150,243,1.000)");
    sink.setToken("space.2", VAL_U32, 8);
    expect(document.documentElement.style.getPropertyValue("--space-2")).toBe("8");
  });
});