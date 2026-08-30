package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

import java.util.List;

/**
 * An overlapping stack (children rendered on top of each other). Rendered as a plain
 * container; the native renderer decides the exact stacking.
 */
public final class ZStack implements View {

    private final List<View> children;

    private ZStack(View... children) {
        this(List.of(children));
    }

    private ZStack(List<View> children) {
        this.children = List.copyOf(children);
    }

    /** An overlapping stack. */
    public static ZStack of(View... children) {
        return new ZStack(children);
    }

    /** An overlapping stack. */
    public static ZStack of(List<View> children) {
        return new ZStack(children);
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.ZSTACK);
        for (View child : children) {
            node.children.add(child.render(env));
        }
        return node;
    }
}