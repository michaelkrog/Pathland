package com.pathland.view;

/**
 * contrast filter ({@code 0..1}).
 */
public final class Contrast implements ViewModifier {

    private final float value;

    private Contrast(float value) {
        this.value = value;
    }

    public static Contrast of(float value) {
        return new Contrast(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.CONTRAST, value));
    }
}
