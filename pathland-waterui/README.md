# pathland-waterui

The Pathland backend for [WaterUI](https://github.com/water-rs/waterui): a bridge
that makes WaterUI the application layer and Pathland the protocol layer.

Pathland is **web-only**: native (Apple/GTK) renders through WaterUI directly.
This crate is the producer side of that split — a server serializes a WaterUI
view tree into Pathland opcodes, projects them to a browser (SSR → HTML, then
live deltas + events over WebSocket), and routes input events back into the
application.

## What it does

Two sides of the same protocol, in one crate:

| Module | Direction | Purpose |
|--------|-----------|---------|
| `producer` (`Emitter`) | WaterUI view → Pathland opcodes | Walk a view tree and emit the declarative structure as self-contained frames |
| `consumer` (`Consumer`) | Pathland opcodes → retained description | Decode frames into a retained node map; `rebuild()` reconstructs WaterUI views (lossless round-trip checks) |

Neither side knows the other's private machinery — WaterUI owns change
detection and native rendering, Pathland owns the 16-byte opcode wire format
(see `spec/OPCODE.md`).

## Mapped components

The producer walks the view tree, expanding composite views through
`View::body` and mapping the native leaves it recognizes:

| WaterUI | Pathland component |
|---------|--------------------|
| `VStack` / `HStack` | `VSTACK` / `HSTACK` |
| `Text` | `TEXT` |
| `Button` | `BUTTON` |
| `Spacer` | `SPACER` |
| `Toggle` (switch / checkbox style) | `SWITCH` / `CHECKBOX` |
| `Slider` | `SLIDER` |
| `.border(...)` modifier | `BORDER_WIDTH` / `BORDER_COLOR` / `BORDER_RADIUS` / `BORDER_EDGES` |

Unrecognized native leaves are the ones Pathland does not model yet — they
fail loudly rather than silently degrade (see `spec/OPCODE.md` for the full
component catalog).

## Reactive emission

WaterUI writable signals live in the engine. While walking, the producer
subscribes to the reactive fields it cares about:

- text content (`SET_TEXT`)
- properties such as stack `SPACING`, `BORDER_COLOR`, toggle `SELECTED`, and
  slider `VALUE` (`SET_PROPERTY`)

A later `set()` on a bound signal re-emits **only** the affected node as a
delta frame — no full tree walk.

## Frames are self-contained

Each frame is pushed to the sink as `(opcodes, strings)`. `SET_TEXT` references
its string by a **relative** offset into that frame's own string section, so a
consumer needs no ring, no mirrored arena, and no prior state to decode a
frame. Nothing is aggregated and nothing is sent on connect — the browser
hydrates the initial SSR HTML and applies each delta in place.

## Interaction

Button actions and toggle flips are captured into a `nodeId → action` map;
slider values into a `nodeId → Binding<f64>` map. A host dispatches inbound
events back into the app:

- `Emitter::invoke(node_id, env)` — button `POINTER_UP`, toggle flip
- `Emitter::set_value(node_id, value)` — slider `VALUE_CHANGED`

## Usage

```rust
use pathland_waterui::Emitter;

let mut emitter = Emitter::with_sink(|opcodes, strings| {
    // encode_frame(&opcodes, &strings) -> WebSocket batch
});
let root = emitter.emit(my_view, &env);
// ... on input: emitter.invoke(target, &env) / emitter.set_value(target, v)
```

## Building

The `waterui` umbrella dependency pulls `waterkit-build`, which compiles Swift,
so a clean build needs the Xcode toolchain on the path:

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
export SDKROOT=$(xcrun --sdk macosx --show-sdk-path)
export PATH="/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin:$PATH"
```

## Testing

```sh
cd pathland-waterui && cargo test
```

Runs the producer → consumer round-trips (structure, reactive deltas, action
and value dispatch) in `tests/roundtrip.rs`.