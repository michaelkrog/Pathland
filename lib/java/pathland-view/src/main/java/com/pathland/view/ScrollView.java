package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

import java.util.List;

/** A scrollable content container (SwiftUI {@code ScrollView}). */
public final class ScrollView implements View {

    private final List<View> children;

    public ScrollView(View... children) {
        this.children = List.of(children);
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.SCROLLVIEW);
        for (View child : children) {
            node.children.add(child.render(env));
        }
        return node;
    }
}