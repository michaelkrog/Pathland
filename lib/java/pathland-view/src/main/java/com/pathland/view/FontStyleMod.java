package com.pathland.view;

/**
 * font style ({@code FONT_STYLE}).
 */
public final class FontStyleMod implements ViewModifier {

    private final float style;

    private FontStyleMod(float style) {
        this.style = style;
    }

    public static FontStyleMod of(FontStyle style) {
        return new FontStyleMod((float) style.wire());
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.FONT_STYLE, style));
    }
}
