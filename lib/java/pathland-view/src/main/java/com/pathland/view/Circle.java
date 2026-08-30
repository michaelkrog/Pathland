package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

/** A circle shape (a {@code SHAPE} node with {@code SHAPE_KIND = Circle}). */
public final class Circle implements View {

    private Circle() {}

    /** A circle. */
    public static Circle of() {
        return new Circle();
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.SHAPE);
        node.properties.put(Properties.SHAPE_KIND, (float) ShapeKind.CIRCLE.wire());
        return node;
    }
}