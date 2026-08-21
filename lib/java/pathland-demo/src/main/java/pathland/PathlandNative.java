package pathland;

import com.sun.jna.Library;
import com.sun.jna.Native;
import com.sun.jna.Pointer;

/**
 * JNA binding for the Pathland native C-ABI shim (libpathland_native).
 *
 * Maps the flat {@code pathland_native_*} functions 1:1 — no per-component
 * wrappers. Component/property ids live in {@code pathland.Constants}
 * (generated from the DSL catalog).
 */
public interface PathlandNative extends Library {

    PathlandNative INSTANCE = Native.load("pathland_native", PathlandNative.class);

    // --- lifetime ---
    Pointer pathland_native_create();
    void pathland_native_destroy(Pointer host);

    // --- flat builder (variants as raw u32) ---
    byte pathland_native_create_node(Pointer host, int id, int component);
    byte pathland_native_insert_child(Pointer host, int parent, int child, int index);
    byte pathland_native_remove_child(Pointer host, int parent, int child);
    byte pathland_native_set_text(Pointer host, int id, String text);
    byte pathland_native_set_property(Pointer host, int id, int prop, int value);
    byte pathland_native_set_property_f32(Pointer host, int id, int prop, float value);

    // --- engine ---
    byte pathland_native_emit(Pointer host);

    // --- zero-copy ring access ---
    Pointer pathland_native_ring_ptr(Pointer host);
    long pathland_native_ring_len(Pointer host);
    long pathland_native_layout_bytes(Pointer host);
    int pathland_native_root_id(Pointer host);
}
