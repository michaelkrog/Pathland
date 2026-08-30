package com.pathland.view;

/**
 * per-glyph kerning in points.
 */
public final class Kerning implements ViewModifier {

    private final float value;

    private Kerning(float value) {
        this.value = value;
    }

    public static Kerning of(float value) {
        return new Kerning(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.KERNING, value));
    }
}
