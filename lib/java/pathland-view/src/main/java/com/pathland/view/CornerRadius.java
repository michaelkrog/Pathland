package com.pathland.view;

/**
 * corner radius ({@code BORDER_RADIUS}).
 */
public final class CornerRadius implements ViewModifier {

    private final float value;

    private CornerRadius(float value) {
        this.value = value;
    }

    public static CornerRadius of(float value) {
        return new CornerRadius(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.BORDER_RADIUS, value));
    }
}
