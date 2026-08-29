package com.pathland.view;

import com.pathland.view.emit.PathlandNode;
import com.pathland.view.signal.WritableSignal;

/**
 * A boolean switch, checkbox, or toggle button (SwiftUI {@code Toggle}). The visual
 * variant is the {@code TOGGLE_STYLE} token ({@code Switch}/{@code Checkbox}/{@code Button}).
 * The checked state binds to a {@link WritableSignal<Boolean>}; user changes flow back
 * as {@code VALUE_CHANGED} (0/1) and are written into the binding.
 */
public final class Toggle implements View {

    private final ToggleStyle style;
    private final boolean selected;
    private final String label;
    private final WritableSignal<Boolean> binding;

    public Toggle(ToggleStyle style, boolean selected, WritableSignal<Boolean> binding, String label) {
        this.style = style;
        this.selected = selected;
        this.binding = binding;
        this.label = label;
    }

    /** A {@code Switch}-style toggle with no label. */
    public Toggle(boolean selected, WritableSignal<Boolean> binding) {
        this(ToggleStyle.SWITCH, selected, binding, null);
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.TOGGLE);
        node.properties.put(Properties.TOGGLE_STYLE, (float) style.wire());
        node.properties.put(Properties.SELECTED, selected ? 1 : 0);
        node.propertyBindings.put(Properties.SELECTED, binding);
        if (label != null) {
            node.text = label;
        }
        node.valueInput = v -> binding.set(v > 0f);
        return node;
    }
}