package com.pathland.view;

/**
 * line spacing in points.
 */
public final class LineSpacing implements ViewModifier {

    private final float value;

    private LineSpacing(float value) {
        this.value = value;
    }

    public static LineSpacing of(float value) {
        return new LineSpacing(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.LINE_SPACING, value));
    }
}
