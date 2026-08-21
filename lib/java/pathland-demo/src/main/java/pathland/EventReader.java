package pathland;

import com.sun.jna.Pointer;

import java.util.ArrayList;
import java.util.List;

/**
 * Decodes raw 16-byte {@code EVENT} opcodes (host → guest) read from the event
 * ring. Each opcode is {@code [category][command][flags:u16][A:u32][B:u32][C:u32]}
 * little-endian; for pointer events {@code B}/{@code C} carry x/y as f32, for
 * key events {@code B}/{@code C} carry keyCode/modifiers.
 */
public final class EventReader {

    public static final int CAT_EVENT = 0x03;
    public static final int POINTER_DOWN = 0x01;
    public static final int POINTER_MOVE = 0x02;
    public static final int POINTER_UP = 0x03;
    public static final int KEY_DOWN = 0x04;
    public static final int KEY_UP = 0x05;

    private EventReader() {}

    /** A decoded raw-input event (category already verified as EVENT). */
    public static final class Event {
        public final int command;
        public final int target;
        public final int flags;
        public final int b;
        public final int c;

        Event(int command, int target, int flags, int b, int c) {
            this.command = command;
            this.target = target;
            this.flags = flags;
            this.b = b;
            this.c = c;
        }

        public float x() {
            return Float.intBitsToFloat(b);
        }

        public float y() {
            return Float.intBitsToFloat(c);
        }

        public boolean isPointerUp() {
            return command == POINTER_UP;
        }

        public boolean isPointerDown() {
            return command == POINTER_DOWN;
        }

        public boolean isPointerMove() {
            return command == POINTER_MOVE;
        }

        /** Whether a pointer-move event is a hover-leave (bit 1 of flags). */
        public boolean isLeaving() {
            return (flags & 0x0002) != 0;
        }
    }

    /**
     * Decode {@code count} raw event opcodes from {@code mem} (≥ {@code count * 16}
     * bytes). Non-EVENT opcodes are skipped.
     */
    public static List<Event> decode(Pointer mem, int count) {
        List<Event> out = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            long base = (long) i * 16;
            int cat = mem.getByte(base) & 0xFF;
            int cmd = mem.getByte(base + 1) & 0xFF;
            int flags = mem.getShort(base + 2) & 0xFFFF;
            int a = mem.getInt(base + 4);
            int b = mem.getInt(base + 8);
            int c = mem.getInt(base + 12);
            if (cat == CAT_EVENT) {
                out.add(new Event(cmd, a, flags, b, c));
            }
        }
        return out;
    }
}
