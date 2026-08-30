package com.pathland.view;

/**
 * underlines the text ({@code UNDERLINE}).
 */
public final class Underline implements ViewModifier {

    private final boolean on;

    private Underline(boolean on) {
        this.on = on;
    }

    /** Underline. */
    public static Underline of() {
        return new Underline(true);
    }

    /** Underline ({@code on} = underline). */
    public static Underline of(boolean on) {
        return new Underline(on);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.UNDERLINE, on ? 1 : 0));
    }
}
