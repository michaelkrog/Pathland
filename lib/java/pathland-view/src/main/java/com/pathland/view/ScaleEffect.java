package com.pathland.view;

/**
 * uniform scale after layout.
 */
public final class ScaleEffect implements ViewModifier {

    private final float value;

    private ScaleEffect(float value) {
        this.value = value;
    }

    public static ScaleEffect of(float value) {
        return new ScaleEffect(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.SCALE, value));
    }
}
