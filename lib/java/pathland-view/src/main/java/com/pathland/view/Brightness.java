package com.pathland.view;

/**
 * brightness filter ({@code -1..1}).
 */
public final class Brightness implements ViewModifier {

    private final float value;

    private Brightness(float value) {
        this.value = value;
    }

    public static Brightness of(float value) {
        return new Brightness(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.BRIGHTNESS, value));
    }
}
