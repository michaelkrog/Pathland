package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

import java.util.List;

/** A static 2D matrix grid (SwiftUI {@code Grid}); children are cells, row-major. */
public final class Grid implements View {

    private final List<View> children;
    private final Alignment alignment;
    private final Float spacing;

    private Grid(View... children) {
        this(null, null, List.of(children));
    }

    private Grid(Alignment alignment, float spacing, View... children) {
        this(alignment, spacing, List.of(children));
    }

    private Grid(Alignment alignment, Float spacing, List<View> children) {
        this.children = List.copyOf(children);
        this.alignment = alignment;
        this.spacing = spacing;
    }

    /** A static 2D matrix grid; children are cells, row-major. */
    public static Grid of(View... children) {
        return new Grid(children);
    }

    /** A static 2D matrix grid with constructor layout properties. */
    public static Grid of(Alignment alignment, float spacing, View... children) {
        return new Grid(alignment, spacing, children);
    }

    /** A static 2D matrix grid with constructor layout properties. */
    public static Grid of(Alignment alignment, Float spacing, List<View> children) {
        return new Grid(alignment, spacing, children);
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.GRID);
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