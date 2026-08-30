package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

/** A vector geometry by {@link ShapeKind} (a {@code SHAPE} node). */
public final class Shape implements View {

    private final ShapeKind kind;

    private Shape(ShapeKind kind) {
        this.kind = kind;
    }

    /** A shape of the given kind (e.g. {@code Shape.of(ShapeKind.PATH)}). */
    public static Shape of(ShapeKind kind) {
        return new Shape(kind);
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.SHAPE);
        node.properties.put(Properties.SHAPE_KIND, (float) kind.wire());
        return node;
    }
}