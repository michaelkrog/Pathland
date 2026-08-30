package com.pathland.view;

/**
 * draw-order elevation within a stack.
 */
public final class ZIndex implements ViewModifier {

    private final float value;

    private ZIndex(float value) {
        this.value = value;
    }

    public static ZIndex of(float value) {
        return new ZIndex(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.Z_INDEX, value));
    }
}
