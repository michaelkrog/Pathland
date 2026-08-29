package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

/** An axis-aligned separator line (orientation implied by the parent stack axis). */
public final class Divider implements View {

    public Divider() {}

    @Override
    public PathlandNode render(Environment env) {
        return new PathlandNode(Components.DIVIDER);
    }
}