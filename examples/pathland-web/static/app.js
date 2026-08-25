// Pathland web client: hydrate the SSR HTML, apply opcode deltas, send events.

const CAT_STYLE = 2;
const CMD_SET_TEXT = 3;
const CAT_EVENT = 3;
const CMD_POINTER_UP = 3;

// Hydrate the server-rendered DOM: node id -> element.
const byId = new Map();
for (const el of document.querySelectorAll("[data-pathland-id]")) {
    byId.set(Number(el.getAttribute("data-pathland-id")), el);
}

// Mirrored arena (append-only). Absolute arenaRef offsets resolve against it.
let arena = new Uint8Array(0);

function appendArena(delta) {
    const merged = new Uint8Array(arena.length + delta.length);
    merged.set(arena, 0);
    merged.set(delta, arena.length);
    arena = merged;
}

function arenaString(offset) {
    const view = new DataView(arena.buffer, arena.byteOffset, arena.byteLength);
    const len = view.getUint32(offset, true);
    const bytes = arena.subarray(offset + 4, offset + 4 + len);
    return new TextDecoder().decode(bytes);
}

function applyBatch(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const opcodeCount = view.getUint32(12, true);
    const opcodesEnd = 16 + opcodeCount * 16;
    const arenaLen = view.getUint32(opcodesEnd, true);
    const arenaStart = opcodesEnd + 4;

    // Seed the arena first so SET_TEXT offsets resolve within this batch.
    appendArena(bytes.subarray(arenaStart, arenaStart + arenaLen));

    for (let i = 0; i < opcodeCount; i++) {
        const pos = 16 + i * 16;
        const category = view.getUint8(pos);
        const command = view.getUint8(pos + 1);
        const a = view.getUint32(pos + 4, true);
        const b = view.getUint32(pos + 8, true);
        if (category === CAT_STYLE && command === CMD_SET_TEXT) {
            const el = byId.get(a);
            if (el) el.textContent = arenaString(b);
        }
    }
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
