# Pathland · @apaq/ngui renderer (Angular)

An **Angular application** that is a Pathland **renderer**: it maps the Pathland
opcode stream onto the **[@apaq/ngui](https://github.com/Apaq/ngui)** Angular
design system (views + modifiers) instead of raw DOM (`app.js`) or SSR HTML.

Like every Pathland renderer it is a **pure function of the opcode stream** — it
retains only its own rendered-output tree (the retained node cache) and never
application state. The app is the *host/driver*: it connects to the Pathland
`/ws` socket, decodes each self-contained `PLPL` frame, and renders ngui views.

## What maps to what

| Pathland component | ngui element |
|--------------------|--------------|
| `VSTACK` / `HSTACK` | `ui-vstack` / `ui-hstack` (`[gap]`, `[alignment]`) |
| `ZSTACK` | `ui-zstack` |
| `TEXT` | `ui-text` (`[text]`, `[multilineTextAlignment]`) |
| `BUTTON` | `ui-button` (`[label]`) |
| `TEXT_FIELD` | `ui-text-field` (`[value]`, `[placeholder]`, `prefix`) |
| `CHECKBOX` / `SWITCH` | `ui-checkbox` / `ui-toggle` |
| `SPACER` | `ui-spacer` |
| `SCROLLVIEW` / `LIST` / `GRID` | `ui-scroll-view` / `ui-list` / `ui-grid` |
| `IMAGE` | `ui-image` |

| Pathland modifier | ngui modifier |
|-------------------|---------------|
| `PADDING` (+ edges) | `[padding]` |
| `COLOR` | `[color]` |
| `BACKGROUND_COLOR` | `[background]` |
| `FONT_SIZE` / `FONT_WEIGHT` / `FONT_FAMILY` | `[font]` |
| `BORDER_*` | `[border]` + `[rounding]` |
| `OPACITY` | `[opacity]` |
| `WIDTH` / `HEIGHT` (fixed / FILL / HUG) | `[frame]` + `[flex]` |
| `LINE_LIMIT` | `[lineLimit]` |

The mapping lives in `src/app/pathland/ngui/mapping.ts`.

## Layout

```
src/app/pathland/
  core/            protocol constants, PLPL decoder, event encoder, retained tree (pure TS, unit-tested)
  ngui/            mapping.ts (Pathland → ngui), node.component (recursive renderer),
                   session.service (WS connect + event routing)
```

## Run

Prereqs: the server demo on :8080 (Spring: `java -jar .../pathland-spring-boot-demo-0.1.0.jar`,
or Quarkus `mvn quarkus:dev`), with the frames-replayed-on-connect change
(any client — including this one — gets the full mount frame on WS connect, so no
SSR pre-step is needed).

```bash
npm install        # @apaq/ngui + @apaq/ngui-elements come from GitHub Packages (see .npmrc)
npx ng serve       # http://localhost:4200 (proxies /ws → localhost:8080)
```

## Test

```bash
npx ng test --watch=false
```