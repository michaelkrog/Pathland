package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

/** Flexible space that expands along a stack's main axis. */
public final class Spacer implements View {

    public Spacer() {}

    @Override
    public PathlandNode render(Environment env) {
        return new PathlandNode(Components.SPACER);
    }
}