package com.pathland.view;

/**
 * constrains the aspect ratio ({@code ASPECT_RATIO} + {@code CONTENT_MODE}).
 */
public final class AspectRatio implements ViewModifier {

    private final float ratio;
    private final float mode;

    private AspectRatio(float ratio, float mode) {
        this.ratio = ratio;
        this.mode = mode;
    }

    public static AspectRatio of(float ratio, ContentMode mode) {
        return new AspectRatio(ratio, (float) mode.wire());
    }

    @Override
    public View body(View content) {
        return Modified.props(content,
                Modified.prop(Properties.ASPECT_RATIO, ratio),
                Modified.prop(Properties.CONTENT_MODE, mode));
    }
}
