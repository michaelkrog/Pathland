package com.pathland.view;

/**
 * Gaussian blur radius.
 */
public final class Blur implements ViewModifier {

    private final float value;

    private Blur(float value) {
        this.value = value;
    }

    public static Blur of(float value) {
        return new Blur(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.BLUR_RADIUS, value));
    }
}
