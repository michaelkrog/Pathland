package com.pathland.view;

/**
 * clips the view to a shape ({@code CLIPS_TO_BOUNDS} + {@code SHAPE_KIND}).
 */
public final class ClipShape implements ViewModifier {

    private final float kind;

    private ClipShape(float kind) {
        this.kind = kind;
    }

    public static ClipShape of(ShapeKind kind) {
        return new ClipShape((float) kind.wire());
    }

    @Override
    public View body(View content) {
        return Modified.props(content,
                Modified.prop(Properties.CLIPS_TO_BOUNDS, 1),
                Modified.prop(Properties.SHAPE_KIND, kind));
    }
}
