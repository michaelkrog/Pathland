// Option A styling: the DOM renderer owns a bounded property → style/class map.
// The protocol stays renderer-agnostic; web-specific Tailwind class resolution
// is the HTML renderer's job (SSR). At runtime, STYLE deltas are applied as
// inline style (which overrides the SSR Tailwind class for the current value),
// literal colors via inline style, and semantic design tokens as CSS variables.

import {
  ALIGN_CENTER,
  ALIGN_FILL,
  ALIGN_LEADING,
  ALIGN_TRAILING,
  PROP_ALIGNMENT,
  PROP_BACKGROUND_COLOR,
  PROP_BORDER_COLOR,
  PROP_BORDER_RADIUS,
  PROP_BORDER_WIDTH,
  PROP_COLOR,
  PROP_CONTENT_MARGINS,
  PROP_ENABLED,
  PROP_HEIGHT,
  PROP_OPACITY,
  PROP_PADDING,
  PROP_PADDING_BOTTOM,
  PROP_PADDING_LEFT,
  PROP_PADDING_RIGHT,
  PROP_PADDING_TOP,
  PROP_SPACING,
  PROP_VISIBLE,
  PROP_WIDTH,
  WIDTH_FILL,
  WIDTH_HUG,
} from "./constants";
import { argbToRgba, f32FromBits, fmtFloat } from "./format";

/** Apply a numeric style property to an element via inline style. */
export function applyStyleProperty(el: HTMLElement, property: number, bits: number): void {
  switch (property) {
    case PROP_SPACING:
      el.style.gap = fmtFloat(f32FromBits(bits)) + "px";
      break;
    case PROP_ALIGNMENT:
      el.style.alignItems = alignmentCss(bits);
      break;
    case PROP_CONTENT_MARGINS:
      el.style.padding = fmtFloat(f32FromBits(bits)) + "px";
      break;
    case PROP_PADDING:
      el.style.padding = fmtFloat(f32FromBits(bits)) + "px";
      break;
    case PROP_PADDING_TOP:
      el.style.paddingTop = fmtFloat(f32FromBits(bits)) + "px";
      break;
    case PROP_PADDING_RIGHT:
      el.style.paddingRight = fmtFloat(f32FromBits(bits)) + "px";
      break;
    case PROP_PADDING_BOTTOM:
      el.style.paddingBottom = fmtFloat(f32FromBits(bits)) + "px";
      break;
    case PROP_PADDING_LEFT:
      el.style.paddingLeft = fmtFloat(f32FromBits(bits)) + "px";
      break;
    case PROP_COLOR:
      el.style.color = argbToRgba(bits);
      break;
    case PROP_BACKGROUND_COLOR:
      el.style.backgroundColor = argbToRgba(bits);
      break;
    case PROP_BORDER_COLOR:
      el.style.borderColor = argbToRgba(bits);
      break;
    case PROP_BORDER_WIDTH:
      el.style.borderWidth = fmtFloat(f32FromBits(bits)) + "px";
      break;
    case PROP_BORDER_RADIUS:
      el.style.borderRadius = fmtFloat(f32FromBits(bits)) + "px";
      break;
    case PROP_OPACITY:
      el.style.opacity = fmtFloat(f32FromBits(bits));
      break;
    case PROP_VISIBLE:
      el.style.display = bits === 0 ? "none" : "";
      break;
    case PROP_WIDTH:
      el.style.width = sizeCss(bits);
      break;
    case PROP_HEIGHT:
      el.style.height = sizeCss(bits);
      break;
    default:
      break;
  }
}

/** Apply a state-class/ARIA toggle for a numeric {@link PROP_ENABLED} delta. */
export function applyEnabled(el: HTMLElement, bits: number): void {
  const disabled = bits === 0;
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLButtonElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  ) {
    el.disabled = disabled;
  } else if (disabled) {
    el.setAttribute("aria-disabled", "true");
  } else {
    el.removeAttribute("aria-disabled");
  }
}

/** Map the protocol {@link Alignment} enum to the cross-axis CSS value. */
export function alignmentCss(bits: number): string {
  switch (bits) {
    case ALIGN_LEADING:
      return "flex-start";
    case ALIGN_TRAILING:
      return "flex-end";
    case ALIGN_FILL:
      return "stretch";
    case ALIGN_CENTER:
    default:
      return "center";
  }
}

/** Map a {@link WIDTH}/{@link HEIGHT} value (FILL/HUG/fixed px) to CSS. */
export function sizeCss(bits: number): string {
  const value = f32FromBits(bits);
  if (value === WIDTH_FILL) {
    return "100%";
  }
  if (value === WIDTH_HUG) {
    return "fit-content";
  }
  return fmtFloat(value) + "px";
}