package pathland;

import com.sun.jna.Pointer;

/**
 * A reactive signal whose value lives in the Rust engine (pathland-core).
 *
 * Java holds only the opaque numeric id plus the host handle; the canonical
 * value and the dependency graph live in Rust. Setting the signal re-emits only
 * the nodes bound to it (via {@code pathland_native_node_bind_text} /
 * {@code pathland_native_node_bind_property}) — no full tree rebuild.
 */
public final class Signal {

    private final Pointer host;
    private final int id;

    private Signal(Pointer host, int id) {
        this.host = host;
        this.id = id;
    }

    /** Create a float signal. */
    public static Signal f32(Pointer host, float value) {
        return new Signal(host, PathlandNative.INSTANCE.pathland_native_signal_create_f32(host, value));
    }

    /** Create a raw u32 signal (color, listener mask, …). */
    public static Signal u32(Pointer host, int value) {
        return new Signal(host, PathlandNative.INSTANCE.pathland_native_signal_create_u32(host, value));
    }

    /** Create a boolean signal. */
    public static Signal bool(Pointer host, boolean value) {
        return new Signal(host, PathlandNative.INSTANCE.pathland_native_signal_create_bool(host, value ? (byte) 1 : (byte) 0));
    }

    /** Create an enum signal (wire value 0..n). */
    public static Signal enumValue(Pointer host, byte value) {
        return new Signal(host, PathlandNative.INSTANCE.pathland_native_signal_create_enum(host, value));
    }

    /** Create a string signal. */
    public static Signal str(Pointer host, String value) {
        return new Signal(host, PathlandNative.INSTANCE.pathland_native_signal_create_string(host, value));
    }

    /** The opaque signal id (for binding). */
    public int id() {
        return id;
    }

    public void setF32(float value) {
        PathlandNative.INSTANCE.pathland_native_signal_set_f32(host, id, value);
    }

    public void setU32(int value) {
        PathlandNative.INSTANCE.pathland_native_signal_set_u32(host, id, value);
    }

    public void setBool(boolean value) {
        PathlandNative.INSTANCE.pathland_native_signal_set_bool(host, id, value ? (byte) 1 : (byte) 0);
    }

    public void setEnum(byte value) {
        PathlandNative.INSTANCE.pathland_native_signal_set_enum(host, id, value);
    }

    public void setString(String value) {
        PathlandNative.INSTANCE.pathland_native_signal_set_string(host, id, value);
    }
}
