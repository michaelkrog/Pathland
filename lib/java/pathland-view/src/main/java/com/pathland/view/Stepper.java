package com.pathland.view;

import com.pathland.view.emit.PathlandNode;
import com.pathland.view.signal.WritableSignal;

/**
 * A discrete increment/decrement control (SwiftUI {@code Stepper}). The value binds to
 * a {@link WritableSignal<Float>}; presses flow back as {@code VALUE_CHANGED}.
 */
public final class Stepper implements View {

    private final float value;
    private final float min;
    private final float max;
    private final float step;
    private final WritableSignal<Float> binding;

    public Stepper(float value, float min, float max, float step, WritableSignal<Float> binding) {
        this.value = value;
        this.min = min;
        this.max = max;
        this.step = step;
        this.binding = binding;
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.STEPPER);
        node.properties.put(Properties.VALUE, value);
        node.properties.put(Properties.MIN_VALUE, min);
        node.properties.put(Properties.MAX_VALUE, max);
        node.properties.put(Properties.STEP_VALUE, step);
        node.propertyBindings.put(Properties.VALUE, binding);
        node.valueInput = binding::set;
        return node;
    }
}