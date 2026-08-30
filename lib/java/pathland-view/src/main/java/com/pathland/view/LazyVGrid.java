package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

import java.util.List;

/** A virtualized vertical grid (windowed realization of cells). */
public final class LazyVGrid implements View {

    private final List<View> children;
    private final Alignment alignment;
    private final Float spacing;

    private LazyVGrid(View... children) {
        this(null, null, List.of(children));
    }

    private LazyVGrid(Alignment alignment, float spacing, View... children) {
        this(alignment, spacing, List.of(children));
    }

    private LazyVGrid(Alignment alignment, Float spacing, List<View> children) {
        this.children = List.copyOf(children);
        this.alignment = alignment;
        this.spacing = spacing;
    }

    /** A virtualized vertical grid; children are cells. */
    public static LazyVGrid of(View... children) {
        return new LazyVGrid(children);
    }

    /** A virtualized vertical grid with constructor layout properties. */
    public static LazyVGrid of(Alignment alignment, float spacing, View... children) {
        return new LazyVGrid(alignment, spacing, children);
    }

    /** A virtualized vertical grid with constructor layout properties. */
    public static LazyVGrid of(Alignment alignment, Float spacing, List<View> children) {
        return new LazyVGrid(alignment, spacing, children);
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