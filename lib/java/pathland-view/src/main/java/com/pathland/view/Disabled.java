package com.pathland.view;

/**
 * disables/enables the view ({@code ENABLED}: 1 = interactive).
 */
public final class Disabled implements ViewModifier {

    private final boolean disabled;

    private Disabled(boolean disabled) {
        this.disabled = disabled;
    }

    /** Disable/enable ({@code disabled} = disabled). */
    public static Disabled of(boolean disabled) {
        return new Disabled(disabled);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.ENABLED, disabled ? 0 : 1));
    }
}
