# Pathland — Proposed Workstreams

Rolling task list of candidate next steps. Each workstream links to its detail plan.

## Completed

- [x] Protocol spec/implementation alignment — merged to main
- [x] Worker-thread bootstrap with binary command transport — `262e524`
- [x] POC worker-safe clock — `0636e06`
- [x] Complete the interaction system — `dac6a91` (branch: feature/interaction-system)
- [x] For-loop positional identity diffing — `006a4cb` (branch: feature/for-loop-diffing)
- [x] Documentation: renderer memory model + conformance vectors — `2afad57` (branch: feature/docs-memory-model)
- [x] Protocol gaps: MOVE_CHILD/RESET, EdgeInsets, coordinate space, env requestId (branch: feature/protocol-gaps)
- [x] Bundle hygiene: jsdom moved to `@pathland/renderer-dom/jsdom` subpath (branch: feature/bundle-hygiene)
- [x] Test suite green: protocol 19, view 25, renderer-dom 12, platform-browser 25

## Workstreams

### 1. Complete the interaction system — DONE

- renderer-dom: long-press, hover, focus/blur, key events wired via
  `data-pathland-node-id` delegation -> `dispatchEvent(nodeId, eventType)`
- view: `hoverGesture` / `focusGesture` / `blurGesture` builders
- Tests: renderer-dom event suite, worker-boundary long-press round-trip
- POC: Demo 10 (long-press counter + hover toggle)
- Follow-up (not done):
  - Gesture lifecycle (GESTURE_UPDATE / ATTACH_GESTURE / COMBINE_GESTURES)
  - Payload-rich events (coordinates, keyCode, hover enter/leave flag)

### 2. For-loop diffing — DONE (positional identity diff)

- Replace delete-all + recreate in `For` with positional identity diffing:
  items whose reference is unchanged at the same index are reused (no commands);
  removed/replaced items are deleted; new items are created + inserted.
- Fixed `Signal.set` to skip side-effect-only (subscribe/map) bindings so
  they no longer emit spurious SET_PROPERTY nodeId=-1 commands.
- Tests: 5 diffing tests (append, remove-last, no-op, replace, node-id reuse)
- Follow-up (not done):
  - Keyed reconciliation with moves (optional key fn; reorder via MOVE_CHILD)
  - Content updates for in-place-mutated items (re-render + property diff)

### 3. Protocol gaps — DONE

- MOVE_CHILD (0x0C): efficient reordering (spec + protocol + renderer-dom + tests + vector)
- RESET (0x0D): re-sync — renderer clears output, app re-emits the tree
- EdgeInsets: PADDING_TOP/RIGHT/BOTTOM/LEFT (0x1012-0x1015) + view `padding(top,right,bottom,left)`
- Event coordinate-space definition (viewport-relative logical points)
- REQUEST_ENVIRONMENT correlation: SET/UPDATE_ENVIRONMENT echo requestId
- Follow-up (not done):
  - Renderer-initiated re-sync (a renderer->app notification to request a RESET+re-emit)

### 4. Documentation — DONE

- "Renderer Memory Model" section in spec/PROTOCOL.md
  (stateless vs rendered-output tree)
- spec/CONFORMANCE.md: golden byte arrays

### 5. Bundle hygiene — DONE

- Moved `createJSDOMRenderer` out of the renderer-dom main entry into the
  `@pathland/renderer-dom/jsdom` subpath; browser bundles no longer pull in
  jsdom (removed the ~2.7MB chunk from the POC build)
