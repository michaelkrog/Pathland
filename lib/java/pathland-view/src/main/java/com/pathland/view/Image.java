package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

/** An image leaf (a native element; the renderer resolves the visual). */
public final class Image implements View {

    public Image() {}

    @Override
    public PathlandNode render(Environment env) {
        return new PathlandNode(Components.IMAGE);
    }
}