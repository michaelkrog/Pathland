package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

/**
 * A rounded rectangle shape (a {@code SHAPE} node with
 * {@code SHAPE_KIND = RoundedRectangle} and {@code BORDER_RADIUS} = corner radius).
 */
public final class RoundedRectangle implements View {

    private final float cornerRadius;

    private RoundedRectangle(float cornerRadius) {
        this.cornerRadius = cornerRadius;
    }

    /** A rounded rectangle with a corner radius. */
    public static RoundedRectangle of(float cornerRadius) {
        return new RoundedRectangle(cornerRadius);
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.SHAPE);
        node.properties.put(Properties.SHAPE_KIND, (float) ShapeKind.ROUNDED_RECTANGLE.wire());
        node.properties.put(Properties.BORDER_RADIUS, cornerRadius);
        return node;
    }
}