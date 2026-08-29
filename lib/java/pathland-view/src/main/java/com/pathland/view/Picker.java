package com.pathland.view;

import com.pathland.view.emit.PathlandNode;
import com.pathland.view.signal.WritableSignal;

import java.util.List;

/**
 * A selection control (SwiftUI {@code Picker}). The options are the child nodes, in
 * display order; {@code SELECTION} is the selected child index. Changes flow back as
 * {@code VALUE_CHANGED} (the new index) into the binding.
 */
public final class Picker implements View {

    private final PickerStyle style;
    private final WritableSignal<Integer> selection;
    private final List<View> options;

    public Picker(PickerStyle style, WritableSignal<Integer> selection, View... options) {
        this.style = style;
        this.selection = selection;
        this.options = List.of(options);
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.PICKER);
        node.properties.put(Properties.PICKER_STYLE, (float) style.wire());
        node.properties.put(Properties.SELECTION, selection.get());
        node.propertyBindings.put(Properties.SELECTION, selection);
        node.valueInput = v -> selection.set(Math.round(v));
        for (View option : options) {
            node.children.add(option.render(env));
        }
        return node;
    }
}