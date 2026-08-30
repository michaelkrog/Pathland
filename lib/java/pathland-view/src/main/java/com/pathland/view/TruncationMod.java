package com.pathland.view;

/**
 * truncation mode for overflowed text ({@code TRUNCATION_MODE}).
 */
public final class TruncationMod implements ViewModifier {

    private final float mode;

    private TruncationMod(float mode) {
        this.mode = mode;
    }

    public static TruncationMod of(Truncation mode) {
        return new TruncationMod((float) mode.wire());
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.TRUNCATION_MODE, mode));
    }
}
