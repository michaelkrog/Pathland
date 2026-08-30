package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

/** A capsule shape (a {@code SHAPE} node with {@code SHAPE_KIND = Capsule}). */
public final class Capsule implements View {

    private Capsule() {}

    /** A capsule. */
    public static Capsule of() {
        return new Capsule();
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.SHAPE);
        node.properties.put(Properties.SHAPE_KIND, (float) ShapeKind.CAPSULE.wire());
        return node;
    }
}