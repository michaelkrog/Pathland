package com.pathland.view;

/**
 * baseline offset in points.
 */
public final class BaselineOffset implements ViewModifier {

    private final float value;

    private BaselineOffset(float value) {
        this.value = value;
    }

    public static BaselineOffset of(float value) {
        return new BaselineOffset(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.BASELINE_OFFSET, value));
    }
}
