package pathland;

/**
 * A view wrapped by an {@code onTapGesture} modifier. Declares the pointer
 * down/up event listeners (the {@code EVENT_LISTENERS} bitmask) and records the
 * app-side tap callback on the built node.
 */
final class TapGesture implements View {
    private final View inner;
    private final Runnable action;

    TapGesture(View inner, Runnable action) {
        this.inner = inner;
        this.action = action;
    }

    @Override
    public Node build() {
        Node node = inner.build();
        int mask = 0;
        Float existing = node.properties.get(Constants.PROP_EVENT_LISTENERS);
        if (existing != null) {
            // Listener masks are stored as raw bit patterns (float bits).
            mask = Float.floatToRawIntBits(existing);
        }
        mask |= Listeners.POINTER_DOWN | Listeners.POINTER_UP;
        node.properties.put(Constants.PROP_EVENT_LISTENERS, Float.intBitsToFloat(mask));
        node.tapActions.add(action);
        return node;
    }
}
