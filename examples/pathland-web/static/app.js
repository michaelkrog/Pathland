// Pathland web client: hydrate the SSR HTML, apply self-contained opcode
// deltas, send events. Each batch carries its own string section, so no arena
// mirror is needed.

const CAT_STYLE = 2;
const CMD_SET_PROPERTY = 1;
const CMD_SET_TEXT = 3;
const CAT_EVENT = 3;
const CMD_POINTER_UP = 3;
const CMD_VALUE_CHANGED = 6;

const PROP_SELECTED = 0x2004;
const PROP_VALUE = 0x2006;
const PROP_BORDER_COLOR = 0x1004;

// Hydrate the server-rendered DOM: node id -> element.
const byId = new Map();
for (const el of document.querySelectorAll("[data-pathland-id]")) {
    byId.set(Number(el.getAttribute("data-pathland-id")), el);
}

// Read a length-prefixed string (`[u32 len][bytes]`) at a relative offset.
function readString(strings, offset) {
    const view = new DataView(strings.buffer, strings.byteOffset, strings.byteLength);
    const len = view.getUint32(offset, true);
    const bytes = strings.subarray(offset + 4, offset + 4 + len);
    return new TextDecoder().decode(bytes);
}

function applyBatch(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const opcodeCount = view.getUint32(12, true);
    const opcodesEnd = 16 + opcodeCount * 16;
    const stringsLen = view.getUint32(opcodesEnd, true);
    const stringsStart = opcodesEnd + 4;
    const strings = bytes.subarray(stringsStart, stringsStart + stringsLen);

    for (let i = 0; i < opcodeCount; i++) {
        const pos = 16 + i * 16;
        const category = view.getUint8(pos);
        const command = view.getUint8(pos + 1);
        const a = view.getUint32(pos + 4, true);
        const b = view.getUint32(pos + 8, true);
        const c = view.getUint32(pos + 12, true);
        if (category === CAT_STYLE && command === CMD_SET_TEXT) {
            const el = byId.get(a);
            if (!el) continue;
            const text = readString(strings, b);
            // Toggles carry their label in an inner span (the outer <label>
            // also holds the <input>, so textContent would clobber it).
            const span = el.querySelector(".pathland-text");
            if (span) span.textContent = text;
            else el.textContent = text;
        } else if (category === CAT_STYLE && command === CMD_SET_PROPERTY) {
            const propId = b & 0xffff;
            if (propId === PROP_SELECTED) {
                const el = byId.get(a);
                if (!el) continue;
                const input = el.querySelector("input[type=checkbox]");
                if (input) input.checked = (c & 0xff) !== 0;
            } else if (propId === PROP_VALUE) {
                const el = byId.get(a);
                if (!el) continue;
                const input = el.querySelector("input[type=range]");
                if (input) input.value = String(f32FromBits(c));
            } else if (propId === PROP_BORDER_COLOR) {
                const el = byId.get(a);
                if (!el) continue;
                const color = argbToRgba(c);
                el.style.borderTopColor = color;
                el.style.borderRightColor = color;
                el.style.borderBottomColor = color;
                el.style.borderLeftColor = color;
            }
        }
    }
}

// Decode a u32 holding f32 bits back into a JS number.
function f32FromBits(bits) {
    return new Float32Array(new Uint32Array([bits]).buffer)[0];
}

// Format a packed 0xAARRGGBB color as an `rgba(...)` string.
function argbToRgba(bits) {
    const a = (bits >>> 24) & 0xff;
    const r = (bits >>> 16) & 0xff;
    const g = (bits >>> 8) & 0xff;
    const b = bits & 0xff;
    return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
}

// Encode a VALUE_CHANGED EVENT opcode (A=target, B=value as f32 bits).
function encodeValueChanged(target, value) {
    const out = new Uint8Array(16 + 16 + 4);
    const header = new DataView(out.buffer);
    header.setUint32(0, 0x504c504c, true); // magic "PLPL"
    header.setUint16(4, 1, true); // version
    header.setUint16(6, 1, true); // flags = HOST_TO_GUEST
    header.setUint32(8, 0, true); // frameCount
    header.setUint32(12, 1, true); // opcodeCount
    const op = new DataView(out.buffer, 16);
    op.setUint8(0, CAT_EVENT);
    op.setUint8(1, CMD_VALUE_CHANGED);
    op.setUint32(4, target, true); // a = target node id
    const bits = new Uint32Array(new Float32Array([value]).buffer)[0];
    op.setUint32(8, bits, true); // b = value (f32 bits)
    return out;
}

// Encode a single PointerUp EVENT opcode as a host -> guest batch.
function encodePointerUp(target) {
    const out = new Uint8Array(16 + 16 + 4);
    const header = new DataView(out.buffer);
    header.setUint32(0, 0x504c504c, true); // magic "PLPL"
    header.setUint16(4, 1, true); // version
    header.setUint16(6, 1, true); // flags = HOST_TO_GUEST
    header.setUint32(8, 0, true); // frameCount
    header.setUint32(12, 1, true); // opcodeCount
    const op = new DataView(out.buffer, 16);
    op.setUint8(0, CAT_EVENT);
    op.setUint8(1, CMD_POINTER_UP);
    op.setUint32(4, target, true); // a = target node id
    return out;
}

const ws = new WebSocket(`ws://${location.host}/ws`);
ws.binaryType = "arraybuffer";
ws.onmessage = (event) => applyBatch(new Uint8Array(event.data));

document.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-pathland-id]");
    if (!button || ws.readyState !== WebSocket.OPEN) return;
    const target = Number(button.getAttribute("data-pathland-id"));
    ws.send(encodePointerUp(target));
});

document.addEventListener("change", (event) => {
    const toggle = event.target.closest("label.pathland-toggle[data-pathland-id]");
    if (!toggle || ws.readyState !== WebSocket.OPEN) return;
    const target = Number(toggle.getAttribute("data-pathland-id"));
    ws.send(encodePointerUp(target));
});

// Sliders report their value live while dragging (real-time).
document.addEventListener("input", (event) => {
    const slider = event.target.closest("input[type=range]");
    if (!slider || ws.readyState !== WebSocket.OPEN) return;
    const label = slider.closest("label.pathland-slider[data-pathland-id]");
    if (!label) return;
    const target = Number(label.getAttribute("data-pathland-id"));
    ws.send(encodeValueChanged(target, Number(slider.value)));
});
