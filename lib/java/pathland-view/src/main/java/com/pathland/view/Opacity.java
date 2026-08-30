package com.pathland.view;

/**
 * opacity ({@code 0..1}).
 */
public final class Opacity implements ViewModifier {

    private final float value;

    private Opacity(float value) {
        this.value = value;
    }

    public static Opacity of(float value) {
        return new Opacity(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.OPACITY, value));
    }
}
