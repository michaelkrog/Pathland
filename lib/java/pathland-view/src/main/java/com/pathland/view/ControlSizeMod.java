package com.pathland.view;

/**
 * control size ({@code CONTROL_SIZE}).
 */
public final class ControlSizeMod implements ViewModifier {

    private final float size;

    private ControlSizeMod(float size) {
        this.size = size;
    }

    public static ControlSizeMod of(ControlSize size) {
        return new ControlSizeMod((float) size.wire());
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.CONTROL_SIZE, size));
    }
}
