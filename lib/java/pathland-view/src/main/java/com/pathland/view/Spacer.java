package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

/** Flexible space that expands along a stack's main axis. */
public final class Spacer implements View {

    private Spacer() {}

    /** A flexible expanding spacer. */
    public static Spacer of() {
        return new Spacer();
    }

    @Override
    public PathlandNode render(Environment env) {
        return new PathlandNode(Components.SPACER);
    }
}