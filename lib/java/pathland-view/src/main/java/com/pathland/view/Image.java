package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

/** An image leaf (a native element; the renderer resolves the visual). */
public final class Image implements View {

    private final String source;

    private Image(String source) {
        this.source = source;
    }

    /** An image with no source (the renderer's default visual). */
    public static Image of() {
        return new Image(null);
    }

    /** An image with a source (resource name, file path, or absolute URL). */
    public static Image of(String source) {
        return new Image(source);
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.IMAGE);
        if (source != null) {
            node.properties.put(Properties.IMAGE_SOURCE, source);
        }
        return node;
    }
}