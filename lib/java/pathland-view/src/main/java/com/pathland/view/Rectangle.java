package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

/** A rectangle shape (a {@code SHAPE} node with {@code SHAPE_KIND = Rectangle}). */
public final class Rectangle implements View {

    private Rectangle() {}

    /** A rectangle shape. */
    public static Rectangle of() {
        return new Rectangle();
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.SHAPE);
        node.properties.put(Properties.SHAPE_KIND, (float) ShapeKind.RECTANGLE.wire());
        return node;
    }
}