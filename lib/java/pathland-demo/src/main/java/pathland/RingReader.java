package pathland;

import com.sun.jna.Pointer;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Reads Pathland opcodes **zero-copy** from the shared-memory ring, matching the
 * stable wire layout in {@code pathland-opcode/src/memory.rs} and
 * {@code spec/OPCODE.md}.
 *
 * The driver is shown the raw ring pointer by the Rust host
 * ({@code pathland_native_ring_ptr}); it reads the header (frameCount, cursors,
 * ring/arena offsets) and the 16-byte opcodes in place — no copies, no
 * serialization.
 */
public final class RingReader {

    // Header field offsets (little-endian), see pathland-opcode::memory.
    static final int OFF_RING_OFFSET = 0x06;
    static final int OFF_SLOT_COUNT = 0x0E;
    static final int OFF_ARENA_OFFSET = 0x12;
    static final int OFF_READ_CURSOR = 0x1E;
    static final int OFF_WRITE_CURSOR = 0x22;

    // Categories / commands.
    static final int CAT_TREE = 0x01;
    static final int CAT_STYLE = 0x02;
    static final int CMD_SET_TEXT = 0x03;

    private RingReader() {}

    private static int u32(Pointer p, long off) {
        // little-endian read
        return p.getInt(off);
    }

    private static int u16(Pointer p, long off) {
        return p.getShort(off) & 0xFFFF;
    }

    /** A decoded reference to a tree node's text (from SET_TEXT). */
    public static final class TextEntry {
        public final int id;
        public final String text;
        TextEntry(int id, String text) {
            this.id = id;
            this.text = text;
        }
    }

    /**
     * Read all {@code STYLE:SET_TEXT} entries in the current ring frame,
     * zero-copy.
     */
    public static List<TextEntry> readTextEntries(Pointer mem) {
        List<TextEntry> out = new ArrayList<>();
        int ringOff = u32(mem, OFF_RING_OFFSET);
        int slotCount = u32(mem, OFF_SLOT_COUNT);
        int arenaOff = u32(mem, OFF_ARENA_OFFSET);
        int readCur = u32(mem, OFF_READ_CURSOR);
        int writeCur = u32(mem, OFF_WRITE_CURSOR);
        if (slotCount <= 0) {
            return out;
        }
        int mask = slotCount - 1;
        int n = writeCur - readCur;
        if (n < 0 || n > slotCount) {
            n = 0; // wrapped; ignore for the reference demo
        }
        for (int i = 0; i < n; i++) {
            int slot = (readCur + i) & mask;
            long base = ringOff + (long) slot * 16;
            int cat = mem.getByte(base) & 0xFF;
            int cmd = mem.getByte(base + 1) & 0xFF;
            int nodeA = u32(mem, base + 4);
            int bVal = u32(mem, base + 8);
            if (cat == CAT_STYLE && cmd == CMD_SET_TEXT) {
                out.add(new TextEntry(nodeA, readArenaString(mem, arenaOff, bVal)));
            }
        }
        return out;
    }

    /** Read an arena string at ref: {@code [u32 len][bytes]} (utf-8). */
    private static String readArenaString(Pointer mem, int arenaOff, int ref) {
        long base = arenaOff + (long) ref;
        int len = u32(mem, base);
        byte[] bytes = mem.getByteArray(base + 4, len);
        return new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
    }
}
