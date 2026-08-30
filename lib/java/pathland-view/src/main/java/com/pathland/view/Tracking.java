package com.pathland.view;

/**
 * uniform letter spacing in points.
 */
public final class Tracking implements ViewModifier {

    private final float value;

    private Tracking(float value) {
        this.value = value;
    }

    public static Tracking of(float value) {
        return new Tracking(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.TRACKING, value));
    }
}
