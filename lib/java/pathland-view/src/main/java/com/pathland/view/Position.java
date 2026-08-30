package com.pathland.view;

/**
 * absolute placement within the parent ({@code POSITION_X} / {@code POSITION_Y}).
 */
public final class Position implements ViewModifier {

    private final float x;
    private final float y;

    private Position(float x, float y) {
        this.x = x;
        this.y = y;
    }

    public static Position of(float x, float y) {
        return new Position(x, y);
    }

    @Override
    public View body(View content) {
        return Modified.props(content,
                Modified.prop(Properties.POSITION_X, x),
                Modified.prop(Properties.POSITION_Y, y));
    }
}
