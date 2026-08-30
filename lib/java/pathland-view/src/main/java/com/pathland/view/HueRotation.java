package com.pathland.view;

/**
 * hue rotation in degrees.
 */
public final class HueRotation implements ViewModifier {

    private final float value;

    private HueRotation(float value) {
        this.value = value;
    }

    public static HueRotation of(float value) {
        return new HueRotation(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.HUE_ROTATION, value));
    }
}
