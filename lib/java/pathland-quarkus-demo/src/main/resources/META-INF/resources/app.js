// Pathland web client: hydrate the SSR HTML, apply self-contained opcode
// deltas, send events. Each batch carries its own string section, so no arena
// mirror is needed.

const CAT_STYLE = 2;
const CMD_SET_PROPERTY = 1;
const CMD_SET_TEXT = 3;
const CMD_SET_DATE = 4;
const CAT_EVENT = 3;
const CMD_POINTER_UP = 3;
const CMD_VALUE_CHANGED = 6;
const CMD_TEXT_CHANGED = 7;
const CMD_DATE_CHANGED = 13;

const VAL_STRING = 5;

const PROP_SELECTED = 0x2004;
const PROP_VALUE = 0x2006;
const PROP_SELECTION = 0x2010;
const PROP_COLOR_VALUE = 0x2012;
const PROP_BORDER_COLOR = 0x1004;
const PROP_LABEL = 0x200a;
const PROP_PROMPT = 0x200b;

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
            // Text fields/editors carry their value in the input; other controls
            // carry their label in an inner span (textContent would clobber it).
            const input = el.querySelector("input[type=text]");
            if (input) input.value = text;
            else {
                const textarea = el.querySelector("textarea");
                if (textarea) textarea.value = text;
                else {
                    const span = el.querySelector(".pathland-text");
                    if (span) span.textContent = text;
                    else el.textContent = text;
                }
            }
        } else if (category === CAT_STYLE && command === CMD_SET_DATE) {
            const el = byId.get(a);
            if (!el) continue;
            const date = el.matches("input[type=date]") ? el : el.querySelector("input[type=date]");
            if (date) {
                date.value = (b === 0 && c === 0)
                    ? ""
                    : new Date(Date.UTC(1970, 0, b)).toISOString().slice(0, 10);
            }
        } else if (category === CAT_STYLE && command === CMD_SET_PROPERTY) {
            const propId = b & 0xffff;
            const valueType = (b >>> 16) & 0xff;
            if (valueType === VAL_STRING) {
                const el = byId.get(a);
                if (!el) continue;
                const text = readString(strings, c);
                if (propId === PROP_LABEL) {
                    const span = el.querySelector(".pathland-label");
                    if (span) span.textContent = text;
                } else if (propId === PROP_PROMPT) {
                    const input = el.querySelector("input[type=text]");
                    if (input) input.placeholder = text;
                }
            } else if (propId === PROP_SELECTED) {
                const el = byId.get(a);
                if (!el) continue;
                const input = el.querySelector("input[type=checkbox]");
                if (input) input.checked = (c & 0xff) !== 0;
            } else if (propId === PROP_VALUE) {
                const el = byId.get(a);
                if (!el) continue;
                const range = el.querySelector("input[type=range]");
                if (range) range.value = String(f32FromBits(c));
                const stepText = el.querySelector(".pathland-stepper span");
                if (stepText) stepText.textContent = String(Math.round(f32FromBits(c) * 100) / 100);
            } else if (propId === PROP_SELECTION) {
                const el = byId.get(a);
                if (!el) continue;
                const select = el.matches("select") ? el : el.querySelector("select");
                if (select) select.value = String(c);
            } else if (propId === PROP_COLOR_VALUE) {
                const el = byId.get(a);
                if (!el) continue;
                const color = el.matches("input[type=color]") ? el : el.querySelector("input[type=color]");
                if (color) color.value = "#" + ((c & 0xffffff) | 0x1000000).toString(16).slice(1);
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

// Encode a single-event host -> guest batch (magic, version, HOST_TO_GUEST flag).
function encodeEvent(command, target, b = 0, c = 0) {
    const out = new Uint8Array(16 + 16 + 4);
    const header = new DataView(out.buffer);
    header.setUint32(0, 0x504c504c, true); // magic "PLPL"
    header.setUint16(4, 1, true); // version
    header.setUint16(6, 1, true); // flags = HOST_TO_GUEST
    header.setUint32(8, 0, true); // frameCount
    header.setUint32(12, 1, true); // opcodeCount
    const op = new DataView(out.buffer, 16);
    op.setUint8(0, CAT_EVENT);
    op.setUint8(1, command);
    op.setUint32(4, target, true); // a = target node id
    op.setUint32(8, b, true);
    op.setUint32(12, c, true);
    return out;
}

// Encode a VALUE_CHANGED EVENT opcode (A=target, B=value as f32 bits).
function encodeValueChanged(target, value) {
    const bits = new Uint32Array(new Float32Array([value]).buffer)[0];
    return encodeEvent(CMD_VALUE_CHANGED, target, bits);
}

// Encode a VALUE_CHANGED with a raw 32-bit payload (e.g. a packed ARGB color).
function encodeValueBits(target, bits) {
    return encodeEvent(CMD_VALUE_CHANGED, target, bits >>> 0);
}

// Encode a DATE_CHANGED EVENT opcode (A=target, B=days, C=millis of day).
function encodeDateChanged(target, days, millis) {
    return encodeEvent(CMD_DATE_CHANGED, target, days >>> 0, millis >>> 0);
}

// Encode a TEXT_CHANGED EVENT opcode; the text rides in the batch's string
// section (A=target, B=relative offset into that section).
function encodeTextChanged(target, text) {
    const textBytes = new TextEncoder().encode(text);
    const out = new Uint8Array(16 + 16 + 4 + 4 + textBytes.length);
    const header = new DataView(out.buffer);
    header.setUint32(0, 0x504c504c, true); // magic "PLPL"
    header.setUint16(4, 1, true); // version
    header.setUint16(6, 1, true); // flags = HOST_TO_GUEST
    header.setUint32(8, 0, true); // frameCount
    header.setUint32(12, 1, true); // opcodeCount
    const op = new DataView(out.buffer, 16);
    op.setUint8(0, CAT_EVENT);
    op.setUint8(1, CMD_TEXT_CHANGED);
    op.setUint32(4, target, true); // a = target node id
    op.setUint32(8, 0, true); // b = relative string offset (first entry)
    const view = new DataView(out.buffer);
    view.setUint32(32, 4 + textBytes.length, true); // stringsLen
    view.setUint32(36, textBytes.length, true); // entry length
    out.set(textBytes, 40);
    return out;
}

// Encode a single PointerUp EVENT opcode as a host -> guest batch.
function encodePointerUp(target) {
    return encodeEvent(CMD_POINTER_UP, target);
}

const ws = new WebSocket(`ws://${location.host}/ws`);
ws.binaryType = "arraybuffer";
ws.onmessage = (event) => applyBatch(new Uint8Array(event.data));

// Buttons (and other `data-pathland-id` buttons) report a tap as POINTER_UP;
// stepper `+`/`−` buttons report VALUE_CHANGED with the clamped next value.
document.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-pathland-id]");
    if (button && ws.readyState === WebSocket.OPEN) {
        const target = Number(button.getAttribute("data-pathland-id"));
        ws.send(encodePointerUp(target));
        return;
    }
    const stepButton = event.target.closest(".pathland-stepper button[data-step]");
    if (stepButton && ws.readyState === WebSocket.OPEN) {
        const stepper = stepButton.closest(".pathland-stepper[data-pathland-id]");
        if (stepper) {
            const target = Number(stepper.getAttribute("data-pathland-id"));
            const valueEl = stepper.querySelector("span");
            const rangeEl = stepper.querySelector(".pathland-stepper-range");
            const current = Number(valueEl ? valueEl.textContent : 0);
            const dir = Number(stepButton.getAttribute("data-step"));
            const min = Number(rangeEl.getAttribute("data-min"));
            const max = Number(rangeEl.getAttribute("data-max"));
            const step = Number(rangeEl.getAttribute("data-step"));
            const next = Math.min(max, Math.max(min, current + dir * step));
            ws.send(encodeValueChanged(target, next));
        }
    }
});

// Toggles report their boolean state as VALUE_CHANGED (0/1); selects report the
// chosen option index; color/date pickers report their raw value.
document.addEventListener("change", (event) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const toggle = event.target.closest("label.pathland-toggle[data-pathland-id]");
    if (toggle) {
        const box = toggle.querySelector("input[type=checkbox]");
        const value = box ? (box.checked ? 1 : 0) : 1;
        ws.send(encodeValueChanged(Number(toggle.getAttribute("data-pathland-id")), value));
        return;
    }
    const select = event.target.closest("select[data-pathland-id]");
    if (select) {
        ws.send(encodeValueChanged(Number(select.getAttribute("data-pathland-id")), Number(select.value)));
        return;
    }
    const color = event.target.closest("input[type=color][data-pathland-id]");
    if (color) {
        const rgb = parseInt(color.value.slice(1), 16);
        ws.send(encodeValueBits(Number(color.getAttribute("data-pathland-id")), 0xff000000 | rgb));
        return;
    }
    const date = event.target.closest("input[type=date][data-pathland-id]");
    if (date) {
        if (date.value) {
            const [y, m, d] = date.value.split("-").map(Number);
            const days = Math.round(Date.UTC(y, m - 1, d) / 86400000);
            ws.send(encodeDateChanged(Number(date.getAttribute("data-pathland-id")), days, 0));
        }
    }
});

// Sliders report their value live while dragging; text fields and editors report
// their text live while typing (all real-time).
document.addEventListener("input", (event) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const slider = event.target.closest("input[type=range]");
    if (slider) {
        const label = slider.closest("label.pathland-slider[data-pathland-id]");
        if (label) {
            ws.send(encodeValueChanged(Number(label.getAttribute("data-pathland-id")), Number(slider.value)));
        }
        return;
    }
    const textarea = event.target.closest("textarea[data-pathland-id]");
    if (textarea) {
        ws.send(encodeTextChanged(Number(textarea.getAttribute("data-pathland-id")), textarea.value));
        return;
    }
    const input = event.target.closest("input[type=text]");
    if (!input) return;
    const label = input.closest("label.pathland-textfield[data-pathland-id]");
    if (!label) return;
    ws.send(encodeTextChanged(Number(label.getAttribute("data-pathland-id")), input.value));
});