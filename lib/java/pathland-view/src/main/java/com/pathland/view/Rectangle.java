package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

/** A rectangle shape (a filled native element). */
public final class Rectangle implements View {

    public Rectangle() {}

    @Override
    public PathlandNode render(Environment env) {
        return new PathlandNode(Components.IMAGE);
    }
}