package com.pathland.view;

/**
 * font width (0.5–1.5, 1.0 default).
 */
public final class FontWidth implements ViewModifier {

    private final float value;

    private FontWidth(float value) {
        this.value = value;
    }

    public static FontWidth of(float value) {
        return new FontWidth(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.FONT_WIDTH, value));
    }
}
