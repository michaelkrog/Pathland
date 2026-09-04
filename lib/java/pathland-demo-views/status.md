# pathland-demo-views — implementation status

**Last updated:** September 3, 2026

The framework-agnostic shared demo views (`com.pathland.demo`), consumed by the
Quarkus and Spring Boot demos. Uses `State` fields wired by the
`pathland-view-processor` annotation processor.

## Implemented

- **`KitchenSinkView`** (the demo root): a scrollable column of every protocol
  section, mounted by both demos' `SessionApp`.
- **Sections** (each a custom `View`):
  - `SectionCard` — reusable titled/bordered/rounded section wrapper.
  - `CounterSection` — `State<Integer>` + `Button` + `Stepper`.
  - `TextFieldSection` — `TextField` + `TextEditor` on one `State<String>`.
  - `ToggleSection` — `Toggle` in all three `ToggleStyle`s.
  - `ValueControlsSection` — `Slider`/`Stepper`/`Gauge`/`ProgressView` on one
    `State<Float>`.
  - `PickerSection` — `Picker` (Segmented + Menu) + `Menu`.
  - `ColorSection` — `ColorPicker` + `Color` as a View + reactive `Rectangle`.
  - `DateSection` — `DatePicker` bound to days-since-epoch.
  - `LayoutSection` — `Grid`/`LazyVStack`/`HStack`+`Spacer`/`ZStack`/`Divider`.
  - `TextStylesSection` — text-formatting modifiers.
  - `AppearanceSection` — border/shadow/opacity/transform/hidden/z-index.
  - `ThemeSection` — **design-token demo**: `Color.token("color.primary")`,
    `Color.token("control.accent")`, `Color.token("color.surface")` /
    `Color.token("dark.color.surface")` and a `control.background`-referenced
    fill, resolving against the active scheme.
- **`DemoTheme`** — the demo's global `SET_DESIGN_TOKEN` theme (base + `dark.*`:
  `color.primary`, `color.surface`, `color.accent`, `space.base`,
  `font.body.family`, `control.*`). Both demos' `SessionApp` pass it to the
  `Emitter`, which rides the overrides into the mount (SSR) + resync frames so
  the HTML/JS client re-themes under `prefers-color-scheme: dark`.
- **Legacy views kept**: `CounterView`, `CounterControls`, `NameField` (still
  covered by `CounterViewTest`).
- **`RouterDemo`** — the shared routing demo (spec DSL.md §4.5): Home → Users →
  UserDetail(`:id`) with `NavigationLink`s, a guarded `/admin` (redirects home),
  and a 404 fallback. `RouterDemo.router(initialPath)` builds the demo's route
  table + a `Router` seeded with the host's initial path (a request URL on SSR);
  the view is a `NavigationContainer`. Consumed by both demos' `SessionApp`
  (which now forward `NAVIGATE` events into `RenderResult.navigateHandler`).

## Not implemented / gaps

- The browser experience depends on the `@pathland/dom-renderer` client
  (`lib/typescript`, built to `dist/pathland-dom-renderer.js` and copied into
  each demo's `src/main/resources`).
- The demos' root is still `KitchenSinkView`; making `RouterDemo` the root (or a
  route) and wiring deep-link URL seeding into the SSR endpoints is a follow-up.

## Verified by

`mvn test -pl pathland-demo-views` (JDK 17+) — `CounterViewTest`,
`KitchenSinkViewTest` (mount + persistence + input routing), and
`RouterDemoTest` (host-seeded first frame, guard-on-initial-URL redirect,
`NavigationLink` push through the tap registry, `NAVIGATE` event routing).