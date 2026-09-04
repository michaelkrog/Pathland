# Pathland Structural Reactivity + Router — Implementation Plan

**Status:** Approved — in progress
**Branch:** `feat/router-structural-reactivity`
**Last Updated:** September 3, 2026

---

## Goal

A cross-platform router for Pathland: browser-path parity (Angular Router /
react-router style) **and** native navigation compatibility (SwiftUI
NavigationStack, Jetpack Compose NavHost, WinUI NavigationView, LVGL screens),
built as a DSL-level construct that respects the protocol's non-negotiables:
stateless renderers, app-owned tree, diff-based emission, "WHAT never WHERE".

## Foundation-first design

**Conditional rendering (structural reactivity) is the reusable primitive.**
A structural container owns a subtree selected by a signal and reconciles it on
change, emitting `TREE` deltas. The router is a structural container whose
content function is route-table matching, plus router-specific extras
(back-stack, URL sync, the `NAVIGATE` event, the `ROUTE`/`TRANSITION`
properties).

## Locked decisions

| Decision | Choice |
|---|---|
| Foundation | Conditional rendering **first** (shared subtree-swap machinery); router built on it |
| Conditional DSL surface (Java) | `Conditional.when(...)` + `Case.of(...)` / `Case.otherwise(...)`, statically importable — mirrors `Signals` (final class, private ctor, lowercase factories) |
| Container | Group-backed slot (bare `VSTACK` node, `Group.java`), not ZStack |
| Protocol surface (router only) | `ROUTE` property, `TRANSITION` hint, `NAVIGATE` event — conditional rendering adds **zero** wire surface |
| State ownership | App owns state; web mirrors history (`popstate` → `NAVIGATE` back to app) |
| Spec ordering | `spec/DSL.md` first (structural-reactivity exception + router), then wire specs |
| Languages | Java + Rust in parallel |
| Event name | `NAVIGATE` (`0x0E`, subsumes back/forward/popstate/deep-link) |
| v1 URL sync | Always `pushState`; `replaceState` for `replace()` = documented follow-up |

## Java conditional API

```java
import static com.pathland.view.Conditional.when;
import static com.pathland.view.Conditional.Case;

when(showLogin, LoginView.of(), HomeView.of());                 // if / else
when(mode, Case.of(HOME, HomeView.of()),
          Case.of(USERS, UsersView.of()),
          Case.otherwise(NotFoundView.of()));                   // switch + default
```

(`if`/`switch`/`case`/`else` are Java keywords — `when` is Kotlin's `switch`
analog and a valid Java identifier.)

## Architecture

1. **Structural container (Java emitter):** owns a subtree selected by a
   signal; on change, rebuilds content and **reconciles** against the retained
   `PathlandNode` snapshot, emitting `TREE` deltas; identical structure → zero
   opcodes.
2. **RouterCore (DSL):** `Router` (`Signal<Route>` + back-stack,
   `navigate/push/pop/replace/back`), `Route`, `RouteTable`, `NavigationContainer`
   (structural container + `ROUTE`/`TRANSITION`), `NavigationLink`, `Location`
   (`Browser`/`InMemory`).
3. **Protocol hooks:** `ROUTE` (URL sync in-stream), `TRANSITION` (native-feel
   transitions), `NAVIGATE` (platform back/gesture → app).

## Native compatibility

SwiftUI `NavigationStack` / Compose `NavHost` → slot + child swap +
`TRANSITION`, back → `NAVIGATE` → `pop()`; WinUI `NavigationView` → `HStack`
sidebar+detail, per-outlet slots; LVGL screens → whole-tree swap (app's
back-stack supplies the stack LVGL lacks).

---

## Phase 0 — Specs first

### 0.1 `spec/DSL.md`

1. **Structural reactivity section (§3.4):** formalize the body-once exception
   — `Conditional.when` re-evaluates content on signal change; the emitter
   reconciles the retained subtree into `TREE` deltas; identical structure →
   zero opcodes; nested containers; value-parametrized content.
2. **Navigation section (§4.5):** `Router`, `RouteTable`, `NavigationContainer`,
   `NavigationLink`, `Location`, back-stack semantics, params, redirects, web
   URL-sync contract, native back — framed as a structural-container use case.
3. **§1 body-once principle** and **§6 convention 7**: cite the exception.
4. **§9.1 checklist:** conditional rendering + navigation entries.
5. **§10 appendix:** `if`/`switch`, `NavigationStack`, `NavigationLink` rows;
   Rust delta note.

### 0.2 Wire specs

6. `PRIMITIVES.md`: composite-notes fix → Group-slot description; `0x17`–`0x1A`
   stay retired.
7. `MODIFIERS.md`: `ROUTE = 0x2019` (STRING), `TRANSITION = 0x1031` (ENUM:
   none/platform-default/fade/slide/scale) + value-type table.
8. `EVENTS.md`: `NAVIGATE = 0x0E` (host→guest, not node-keyed; optional URL
   payload on web, none = back-step on native).
9. `OPCODE.md`: value types + `NAVIGATE` payload note. Version stays 1.
10. `CONFORMANCE.md`: golden vectors — `SET_PROPERTY ROUTE` frame; `NAVIGATE`
    with URL; structural-swap `TREE` deltas.

## Phase 1 — Java structural reactivity (ships alone)

11. Emitter subtree reconcile (`Emitter.java`): retained-snapshot diff → `TREE`
    deltas, mirroring Rust `reconcile_node`; `StructuralEffect` mechanism; no
    new protocol surface.
12. `Conditional.when(...)` + `Case.of`/`Case.otherwise`, Group-backed, nested
    allowed.
13. Tests: branch-swap deltas; identical structure → zero opcodes; nested
    `when`; byte parity.

## Phase 2 — Java router (on top)

14. `Route`/`RouteTable`/`Router`/`Location`/`NavigationContainer`/
    `NavigationLink`; `ROUTE` + `TRANSITION` props; `NAVIGATE` → `RenderResult`
    navigation sink.
15. Tests: route-change structural deltas + property diff; unchanged → zero
    opcodes; `NAVIGATE` round-trip.

## Phase 3 — Rust

16. `if`/`match` in `build()` (free), optional `switch!` macro;
    `Route`/`RouteTable`/`Router` over `pathland-core::signal`; GTK demo (Home →
    Users → UserDetail `:id`); no engine change.

## Phase 4 — Renderers + DOM client

17. `pathland-render-html`: `ROUTE` → `data-pathland-route`; `TRANSITION` →
    CSS class.
18. `lib/typescript`: hydrate reads route attr (no pushState); `SET_PROPERTY
    ROUTE` → `history.pushState`; `popstate` → `NAVIGATE` over `/ws`;
    TRANSITION CSS. No sync loop.
19. `pathland-render-gtk`: Escape/back → `NAVIGATE` (no payload); optional fade.

## Phase 5 — Demos + status

20. `pathland-demo-views`: shared `RouterDemo`; Quarkus/Spring WS handlers
    forward `NAVIGATE` → session routers.
21. **status.md updates in the same changes** (per AGENTS.md): `pathland-core`,
    `pathland-engine`, `pathland-view`, `pathland-render-gtk`,
    `pathland-render-html`, `lib/java/pathland-view`, `lib/typescript`,
    `pathland-demo-views`.

## Open follow-ups

- `replaceState` for `replace()` (needs a wire distinction from `pushState`).
- Per-destination enter/exit transitions; multi-outlet/nested routers; a true
  passthrough `Group` protocol component; typed route params.