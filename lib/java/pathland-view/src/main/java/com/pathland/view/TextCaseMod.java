package com.pathland.view;

/**
 * text case transformation ({@code TEXT_CASE}).
 */
public final class TextCaseMod implements ViewModifier {

    private final float textCase;

    private TextCaseMod(float textCase) {
        this.textCase = textCase;
    }

    public static TextCaseMod of(TextCase textCase) {
        return new TextCaseMod((float) textCase.wire());
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.TEXT_CASE, textCase));
    }
}
