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
  HTML in one pass (no retained tree, no `applyFrame`); `compileTailwind(override, classes)`
  returns the compiled Tailwind CSS via `pathland_tailwind_compile`; `pathland_html_free`
  releases native strings. Lazy-loaded; skipped (test assumption) when the dylib
  is absent from `java.library.path`.
- **Full Rust renderer surface** (canonical): all spec components render with
  Tailwind utility classes (structural + decorative), ARIA/event attributes,
  `IS_SECURE` → password, `TOGGLE_STYLE` variants, `DATE_PICKER_MODE`, and
  literal colors inline (Option A).
- **Demos use the shim**: `SessionApp` no longer calls `applyFrame`; SSR renders
  the mount frame through `HtmlRenderer.render(sink.frame(), rootId)`. The
  renderer is compiled once at startup.

## Not implemented / gaps

- The demo `/tailwind.css` endpoint currently hardcodes a small safelist (the
  authoritative safelist lives in the Rust renderer's `tw::safelist()`); a
  Rust→Java bridge carrying it is a follow-up (grant WP2 conformance).

## Verified by

`mvn test -pl pathland-render-html` — JNA shim tests (skip when the Rust dylib
is absent); part of the 44-test non-demo reactor run on JDK 17.
