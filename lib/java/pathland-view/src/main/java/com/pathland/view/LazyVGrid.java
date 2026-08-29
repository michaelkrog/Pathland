package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

import java.util.List;

/** A virtualized vertical grid (windowed realization of cells). */
public final class LazyVGrid implements View {

    private final List<View> children;
    private final Alignment alignment;
    private final Float spacing;

    public LazyVGrid(View... children) {
        this(null, null, List.of(children));
    }

    public LazyVGrid(Alignment alignment, float spacing, View... children) {
        this(alignment, spacing, List.of(children));
    }

    public LazyVGrid(Alignment alignment, Float spacing, List<View> children) {
        this.children = List.copyOf(children);
        this.alignment = alignment;
        this.spacing = spacing;
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.LAZY_VGRID);
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