package com.pathland.view;

/**
 * grayscale filter ({@code 0..1}).
 */
public final class Grayscale implements ViewModifier {

    private final float value;

    private Grayscale(float value) {
        this.value = value;
    }

    public static Grayscale of(float value) {
        return new Grayscale(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.GRAYSCALE, value));
    }
}
