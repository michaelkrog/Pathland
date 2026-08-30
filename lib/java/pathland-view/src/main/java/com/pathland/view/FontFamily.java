package com.pathland.view;

/**
 * font family (a {@code STRING} property).
 */
public final class FontFamily implements ViewModifier {

    private final String value;

    private FontFamily(String value) {
        this.value = value;
    }

    public static FontFamily of(String value) {
        return new FontFamily(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.FONT_FAMILY, value));
    }
}
