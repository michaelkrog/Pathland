package com.pathland.view;

/**
 * layout priority for stretching/shrinking.
 */
public final class LayoutPriority implements ViewModifier {

    private final float value;

    private LayoutPriority(float value) {
        this.value = value;
    }

    public static LayoutPriority of(float value) {
        return new LayoutPriority(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.LAYOUT_PRIORITY, value));
    }
}
