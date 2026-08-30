package com.pathland.view;

/**
 * a shadow ({@code SHADOW_COLOR} + {@code SHADOW_RADIUS} + {@code SHADOW_X} + {@code SHADOW_Y}).
 */
public final class Shadow implements ViewModifier {

    private final Color color;
    private final Float radius;
    private final float x;
    private final float y;

    private Shadow(Color color, Float radius, float x, float y) {
        this.color = color;
        this.radius = radius;
        this.x = x;
        this.y = y;
    }

    /** A shadow with color, radius, and offset. */
    public static Shadow of(Color color, float radius, float x, float y) {
        return new Shadow(color, radius, x, y);
    }

    /** A shadow with just a radius (renderer-token color). */
    public static Shadow of(float radius) {
        return new Shadow(null, radius, 0f, 0f);
    }

    @Override
    public View body(View content) {
        if (color == null) {
            return Modified.props(content, Modified.prop(Properties.SHADOW_RADIUS, radius));
        }
        return Modified.props(content,
                Modified.prop(Properties.SHADOW_COLOR, color),
                Modified.prop(Properties.SHADOW_RADIUS, radius),
                Modified.prop(Properties.SHADOW_X, x),
                Modified.prop(Properties.SHADOW_Y, y));
    }
}
