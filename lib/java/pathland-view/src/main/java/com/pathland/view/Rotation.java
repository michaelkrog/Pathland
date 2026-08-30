package com.pathland.view;

/**
 * rotation after layout, in degrees (counter-clockwise).
 */
public final class Rotation implements ViewModifier {

    private final float value;

    private Rotation(float value) {
        this.value = value;
    }

    public static Rotation of(float value) {
        return new Rotation(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.ROTATION_DEGREES, value));
    }
}
