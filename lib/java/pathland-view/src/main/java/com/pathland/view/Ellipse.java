package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

/** An ellipse shape (a {@code SHAPE} node with {@code SHAPE_KIND = Ellipse}). */
public final class Ellipse implements View {

    private Ellipse() {}

    /** An ellipse. */
    public static Ellipse of() {
        return new Ellipse();
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.SHAPE);
        node.properties.put(Properties.SHAPE_KIND, (float) ShapeKind.ELLIPSE.wire());
        return node;
    }
}