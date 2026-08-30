package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

import java.util.List;

/** A virtualized horizontal grid (windowed realization of cells). */
public final class LazyHGrid implements View {

    private final List<View> children;
    private final Alignment alignment;
    private final Float spacing;

    private LazyHGrid(View... children) {
        this(null, null, List.of(children));
    }

    private LazyHGrid(Alignment alignment, float spacing, View... children) {
        this(alignment, spacing, List.of(children));
    }

    private LazyHGrid(Alignment alignment, Float spacing, List<View> children) {
        this.children = List.copyOf(children);
        this.alignment = alignment;
        this.spacing = spacing;
    }

    /** A virtualized horizontal grid; children are cells. */
    public static LazyHGrid of(View... children) {
        return new LazyHGrid(children);
    }

    /** A virtualized horizontal grid with constructor layout properties. */
    public static LazyHGrid of(Alignment alignment, float spacing, View... children) {
        return new LazyHGrid(alignment, spacing, children);
    }

    /** A virtualized horizontal grid with constructor layout properties. */
    public static LazyHGrid of(Alignment alignment, Float spacing, List<View> children) {
        return new LazyHGrid(alignment, spacing, children);
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.LAZY_HGRID);
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