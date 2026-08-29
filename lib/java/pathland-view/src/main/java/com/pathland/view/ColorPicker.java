package com.pathland.view;

import com.pathland.view.emit.PathlandNode;
import com.pathland.view.signal.WritableSignal;

/**
 * A native system color picker (SwiftUI {@code ColorPicker}). The selected color binds
 * to a {@link WritableSignal<Color>}; changes flow back as {@code VALUE_CHANGED} carrying
 * the packed {@code 0xAARRGGBB} color reinterpreted as an f32 bit pattern.
 */
public final class ColorPicker implements View {

    private final WritableSignal<Color> binding;

    public ColorPicker(WritableSignal<Color> binding) {
        this.binding = binding;
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.COLOR_PICKER);
        node.properties.put(Properties.COLOR_VALUE, binding.get());
        node.propertyBindings.put(Properties.COLOR_VALUE, binding);
        node.valueInput = v -> binding.set(new Color(Float.floatToRawIntBits(v)));
        return node;
    }
}