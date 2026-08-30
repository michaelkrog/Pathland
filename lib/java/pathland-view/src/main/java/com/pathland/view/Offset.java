package com.pathland.view;

/**
 * a post-layout translation ({@code OFFSET_X} / {@code OFFSET_Y}).
 */
public final class Offset implements ViewModifier {

    private final float x;
    private final float y;

    private Offset(float x, float y) {
        this.x = x;
        this.y = y;
    }

    public static Offset of(float x, float y) {
        return new Offset(x, y);
    }

    @Override
    public View body(View content) {
        return Modified.props(content,
                Modified.prop(Properties.OFFSET_X, x),
                Modified.prop(Properties.OFFSET_Y, y));
    }
}
