package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

import java.util.List;

/**
 * A vertical stack. {@code alignment} and {@code spacing} are constructor
 * (structural/layout) properties — never chainable modifiers.
 */
public final class VStack implements View {

    private final List<View> children;
    private final Alignment alignment;
    private final Float spacing;

    public VStack(View... children) {
        this(null, null, List.of(children));
    }

    public VStack(List<View> children) {
        this(null, null, children);
    }

    public VStack(Alignment alignment, float spacing, View... children) {
        this(alignment, spacing, List.of(children));
    }

    public VStack(Alignment alignment, Float spacing, List<View> children) {
        this.children = List.copyOf(children);
        this.alignment = alignment;
        this.spacing = spacing;
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.VSTACK);
        if (alignment != null) {
            node.properties.put(Properties.ALIGNMENT, (float) alignment.wire());
        }
        if (spacing != null) {
            node.properties.put(Properties.SPACING, spacing);
        }
        for (View child : children) {
            node.children.add(child.render(env));
        }
        return node;
    }
}