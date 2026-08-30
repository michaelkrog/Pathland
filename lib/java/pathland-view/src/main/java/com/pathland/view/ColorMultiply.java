package com.pathland.view;

/**
 * multiplies the view's color ({@code COLOR_MULTIPLY}).
 */
public final class ColorMultiply implements ViewModifier {

    private final Color color;

    private ColorMultiply(Color color) {
        this.color = color;
    }

    public static ColorMultiply of(Color color) {
        return new ColorMultiply(color);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.COLOR_MULTIPLY, color));
    }
}
