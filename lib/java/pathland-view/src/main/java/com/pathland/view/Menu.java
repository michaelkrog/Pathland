package com.pathland.view;

import com.pathland.view.emit.PathlandNode;
import com.pathland.view.signal.WritableSignal;

import java.util.List;

/**
 * A contextual action trigger and popover container (SwiftUI {@code Menu}). The first
 * child is the custom trigger; the rest are action items ({@code Button}/{@code Toggle}/
 * nested {@code Menu}). When a {@code selection} binding is provided, choosing an item
 * reports its index as {@code VALUE_CHANGED}.
 */
public final class Menu implements View {

    private final List<View> children;
    private final WritableSignal<Integer> selection;

    public Menu(View trigger, View... actions) {
        this(trigger, null, actions);
    }

    public Menu(View trigger, WritableSignal<Integer> selection, View... actions) {
        List<View> all = new java.util.ArrayList<>(1 + actions.length);
        all.add(trigger);
        all.addAll(List.of(actions));
        this.children = List.copyOf(all);
        this.selection = selection;
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.MENU);
        for (View child : children) {
            node.children.add(child.render(env));
        }
        if (selection != null) {
            node.valueInput = v -> selection.set(Math.round(v));
        }
        return node;
    }
}