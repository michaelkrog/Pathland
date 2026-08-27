package com.pathland.view;

import com.pathland.view.emit.PathlandNode;
import com.pathland.view.signal.Signal;

/**
 * A text leaf. Content is static or bound to a reactive {@link Signal<String>}; a
 * bound text re-emits only this node's {@code SET_TEXT} when the signal changes.
 */
public final class Text implements View {

    private final String text;
    private final Signal<String> binding;

    private Text(String text, Signal<String> binding) {
        this.text = text;
        this.binding = binding;
    }

    /** Static text. */
    public static Text of(String text) {
        return new Text(text, null);
    }

    /** Reactive text (the current value is read at render time). */
    public static Text of(Signal<String> binding) {
        return new Text(null, binding);
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.TEXT);
        if (binding != null) {
            node.textBinding = binding;
            node.text = binding.get();
        } else {
            node.text = text;
        }
        return node;
    }
}