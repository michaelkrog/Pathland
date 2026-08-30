package com.pathland.view;

/**
 * accent/tint color ({@code TINT}).
 */
public final class Tint implements ViewModifier {

    private final Color color;

    private Tint(Color color) {
        this.color = color;
    }

    /** The accent/tint color. */
    public static Tint of(Color color) {
        return new Tint(color);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.TINT, color));
    }
}
