package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

/** An image leaf (a native element; the renderer resolves the visual). */
public final class Image implements View {

    private final String source;

    public Image() {
        this(null);
    }

    /** An image with a source (resource name, file path, or absolute URL). */
    public Image(String source) {
        this.source = source;
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