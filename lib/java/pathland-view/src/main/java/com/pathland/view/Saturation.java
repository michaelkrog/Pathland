package com.pathland.view;

/**
 * saturation filter ({@code 0..1}).
 */
public final class Saturation implements ViewModifier {

    private final float value;

    private Saturation(float value) {
        this.value = value;
    }

    public static Saturation of(float value) {
        return new Saturation(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.SATURATION, value));
    }
}
