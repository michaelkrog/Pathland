package com.pathland.view;

import com.pathland.view.emit.PathlandNode;
import com.pathland.view.signal.WritableSignal;

/**
 * A continuous or stepped numeric range control (SwiftUI {@code Slider}). The value
 * binds to a {@link WritableSignal<Float>}; user drags flow back as {@code VALUE_CHANGED}.
 */
public final class Slider implements View {

    private final float value;
    private final float min;
    private final float max;
    private final WritableSignal<Float> binding;

    public Slider(float value, float min, float max, WritableSignal<Float> binding) {
        this.value = value;
        this.min = min;
        this.max = max;
        this.binding = binding;
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.SLIDER);
        node.properties.put(Properties.VALUE, value);
        node.properties.put(Properties.MIN_VALUE, min);
        node.properties.put(Properties.MAX_VALUE, max);
        node.propertyBindings.put(Properties.VALUE, binding);
        node.valueInput = binding::set;
        return node;
    }
}