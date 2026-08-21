package pathland;

/**
 * Bits for the {@code EVENT_LISTENERS} semantic property (a u32 bitmask).
 *
 * Mirrors {@code pathland_opcode::listener}. Each bit requests that a renderer
 * attach native input recognition for the matching raw-input event, so any
 * element — not just a button — can emit raw events.
 */
public final class Listeners {

    public static final int POINTER_DOWN = 1 << 0;
    public static final int POINTER_MOVE = 1 << 1;
    public static final int POINTER_UP = 1 << 2;
    public static final int KEY_DOWN = 1 << 3;
    public static final int KEY_UP = 1 << 4;

    public static final int POINTER = POINTER_DOWN | POINTER_MOVE | POINTER_UP;

    private Listeners() {}
}
