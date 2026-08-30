package com.pathland.view;

/**
 * strikethrough the text ({@code STRIKETHROUGH}).
 */
public final class Strikethrough implements ViewModifier {

    private final boolean on;

    private Strikethrough(boolean on) {
        this.on = on;
    }

    /** Strikethrough. */
    public static Strikethrough of() {
        return new Strikethrough(true);
    }

    /** Strikethrough ({@code on} = strikethrough). */
    public static Strikethrough of(boolean on) {
        return new Strikethrough(on);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.STRIKETHROUGH, on ? 1 : 0));
    }
}
