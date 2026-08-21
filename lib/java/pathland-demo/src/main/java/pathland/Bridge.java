package pathland;

import com.sun.jna.Pointer;

/**
 * Bridges a Java DSL {@link Node} tree into the flat Rust {@code pathland_native}
 * surface, then emits opcodes into the shared ring.
 *
 * This is the cross-language bridge: the Java DSL (any {@link View}, custom or
 * core) resolves to a {@link Node} tree, which is walked here into the flat
 * {@code pathland_native_create_node} / {@code set_text} / {@code set_property}
 * / {@code insert_child} calls — no per-component wrappers. Custom views and
 * core (Rust) views are indistinguishable.
 */
public final class Bridge {

    private static int nextId = 1;

    private final Pointer host;

    public Bridge(Pointer host) {
        this.host = host;
    }

    /// Assign stable sequential ids (pre-order) to a freshly built tree.
    public void assignIds(Node root) {
        assign(root);
    }

    private void assign(Node node) {
        node.id = nextId++;
        for (Node child : node.children) {
            assign(child);
        }
    }

    /**
     * Send a full DSL tree into the Rust retained tree (flat builder calls),
     * then {@code emit} opcodes into the shared ring. Returns the node id →
     * tap-callback map collected from the freshly assigned tree, so the app can
     * route recognized taps back to the {@code onTapGesture} actions.
     */
    public java.util.Map<Integer, Runnable> importTreeAndEmit(Node root) {
        nextId = 1;
        assign(root);
        java.util.Map<Integer, Runnable> taps = new java.util.LinkedHashMap<>();
        collectTaps(root, taps);
        send(root);
        emit();
        return taps;
    }

    private void collectTaps(Node node, java.util.Map<Integer, Runnable> out) {
        for (Runnable action : node.tapActions) {
            out.put(node.id, action);
        }
        for (Node child : node.children) {
            collectTaps(child, out);
        }
    }

    private void send(Node node) {
        PathlandNative.INSTANCE.pathland_native_create_node(host, node.id, node.component);
        if (!node.string.isEmpty()) {
            setText(node);
        }
        for (Node child : node.children) {
            send(child);
            // -1 (0xFFFFFFFF as u32) = append.
            PathlandNative.INSTANCE.pathland_native_insert_child(host, node.id, child.id, -1);
        }
        for (java.util.Map.Entry<Integer, Float> e : node.properties.entrySet()) {
            PathlandNative.INSTANCE.pathland_native_set_property_f32(
                    host, node.id, e.getKey(), e.getValue());
        }
    }

    /// Set text on a text or button node.
    private void setText(Node node) {
        PathlandNative.INSTANCE.pathland_native_set_text(host, node.id, node.string);
    }

    /// Update just a single node's text (for increments) then emit.
    public void updateTextAndEmit(int id, String text) {
        PathlandNative.INSTANCE.pathland_native_set_text(host, id, text);
        emit();
    }

    /** Emit the retained tree as opcodes into the shared ring. */
    public void emit() {
        PathlandNative.INSTANCE.pathland_native_emit(host);
    }
}
