package com.pathland.view;

/**
 * fixes the view to its intrinsic content size ({@code FIXED_SIZE_*}).
 */
public final class FixedSize implements ViewModifier {

    private final boolean horizontal;
    private final boolean vertical;

    private FixedSize(boolean horizontal, boolean vertical) {
        this.horizontal = horizontal;
        this.vertical = vertical;
    }

    /** Fix both axes. */
    public static FixedSize of() {
        return new FixedSize(true, true);
    }

    /** Fix per axis. */
    public static FixedSize of(boolean horizontal, boolean vertical) {
        return new FixedSize(horizontal, vertical);
    }

    @Override
    public View body(View content) {
        return Modified.props(content,
                Modified.prop(Properties.FIXED_SIZE_HORIZONTAL, horizontal ? 1 : 0),
                Modified.prop(Properties.FIXED_SIZE_VERTICAL, vertical ? 1 : 0));
    }
}
