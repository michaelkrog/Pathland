# Pathland — Proposed Workstreams

Rolling task list of candidate next steps. Each workstream links to its detail plan.

## Completed

- [x] Protocol spec/implementation alignment — merged to main
- [x] Worker-thread bootstrap with binary command transport — `262e524`
- [x] POC worker-safe clock — `0636e06`
- [x] Complete the interaction system — `dac6a91` (branch: feature/interaction-system)
- [x] Test suite green: protocol 17, view 19, renderer-dom 8, platform-browser 25

## Workstreams

### 1. Complete the interaction system — DONE

- renderer-dom: long-press, hover, focus/blur, key events wired via
  `data-pathland-node-id` delegation -> `dispatchEvent(nodeId, eventType)`
- view: `hoverGesture` / `focusGesture` / `blurGesture` builders
- Tests: renderer-dom event suite (8), worker-boundary long-press round-trip
- POC: Demo 10 (long-press counter + hover toggle)
- Follow-up (not done):
  - Gesture lifecycle (GESTURE_UPDATE / ATTACH_GESTURE / COMBINE_GESTURES)
  - Payload-rich events (coordinates, keyCode, hover enter/leave flag)

### 2. For-loop diffing — DONE (positional identity diff)

- Replace delete-all + recreate in `For` with positional identity diffing:
  items whose reference is unchanged at the same index are reused (no commands);
  removed/replaced items are deleted; new items are created + inserted.
- Also fixed `Signal.set` to skip side-effect-only (subscribe/map) bindings so
  they no longer emit spurious SET_PROPERTY nodeId=-1 commands.
- Tests: 5 new diffing tests (append, remove-last, no-op, replace, node-id reuse)
- Follow-up (not done):
  - Keyed reconciliation with moves (optional key fn; reorder via REMOVE+INSERT)
  - Content updates for in-place-mutated items (re-render + property diff)

### 3. Protocol gaps

- Re-sync opcode (renderer recovery after a missed batch) — non-worker / lossy transports
- MOVE_CHILD opcode (efficient reorders)
- EdgeInsets per-edge padding
- Event coordinate-space definition
- REQUEST_ENVIRONMENT response correlation (requestId echo)

### 4. Documentation

- "Renderer Memory Model" section in spec/PROTOCOL.md
  (stateless vs rendered-output tree)
- Conformance test-vectors file (golden byte arrays)

### 5. Bundle hygiene

- Externalize jsdom from the browser bundle
  (renderer-dom `createJSDOMRenderer` -> ~2.7MB chunk)
