package com.pathland.view;

/**
 * minimum scale factor for text shrinking.
 */
public final class MinimumScaleFactor implements ViewModifier {

    private final float value;

    private MinimumScaleFactor(float value) {
        this.value = value;
    }

    public static MinimumScaleFactor of(float value) {
        return new MinimumScaleFactor(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.MINIMUM_SCALE_FACTOR, value));
    }
}
