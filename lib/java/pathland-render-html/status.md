# pathland-render-html (Java) — implementation status

**Last updated:** September 1, 2026

The **Java binding to the Rust HTML renderer** (`com.pathland.render.html`) — a
thin **JNA shim** over `libpathland_render_html`. There is a **single renderer**
(the Rust crate), reused by every language; the former hand-written retained
Java renderer is removed. Protocol contract: `spec/`.

## Implemented

- **Stateless JNA shim**: `HtmlRenderer.instance()` links the Rust cdylib;
  `render(frame, root)` / `renderFragment(frame, root)` /
  `renderFullSnapshot(frame, root)` render a self-contained snapshot frame to
  HTML in one pass (no retained tree, no `applyFrame`); `compileTailwind(overrideCss)`
  returns the compiled Tailwind CSS via `pathland_tailwind_compile` (the class
  safelist is owned internally by the Rust renderer — no `classes` parameter);
  `pathland_html_free` releases native strings. Lazy-loaded; skipped (test
  assumption) when the dylib is absent from `java.library.path`.
- **Full Rust renderer surface** (canonical): all spec components render with
  Tailwind utility classes (structural + decorative), ARIA/event attributes,
  `IS_SECURE` → password, `TOGGLE_STYLE` variants, `DATE_PICKER_MODE`, and
  literal colors inline (Option A).
- **Demos use the shim**: `SessionApp` no longer calls `applyFrame`; SSR renders
  the mount frame through `HtmlRenderer.render(sink.frame(), rootId)`. The
  renderer is compiled once at startup.

## Not implemented / gaps

- The Tailwind class safelist is owned internally by the Rust renderer
  (`tw::safelist()`); it is a complete static set (compiled once at startup) of
  the finite protocol-enum-derived classes, and arbitrary-number (dp) styling
  renders inline — so the compiled `/tailwind.css` is small and static. The demo
  `/tailwind.css` endpoint calls `compileTailwind("")` and gets this CSS.

## Verified by

`mvn test -pl pathland-render-html` — JNA shim tests (skip when the Rust dylib
is absent); part of the 44-test non-demo reactor run on JDK 17.
