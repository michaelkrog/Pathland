package com.pathland.view;

/**
 * aligns the text block inside its own bounds ({@code TEXT_ALIGNMENT}).
 */
public final class TextAlignmentMod implements ViewModifier {

    private final float alignment;

    private TextAlignmentMod(float alignment) {
        this.alignment = alignment;
    }

    public static TextAlignmentMod of(TextAlignment alignment) {
        return new TextAlignmentMod((float) alignment.wire());
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.TEXT_ALIGNMENT, alignment));
    }
}
