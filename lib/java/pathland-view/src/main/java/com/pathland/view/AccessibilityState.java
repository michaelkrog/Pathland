package com.pathland.view;

/**
 * the accessibility state ({@code STATE} semantic enum code).
 */
public final class AccessibilityState implements ViewModifier {

    private final float value;

    private AccessibilityState(float value) {
        this.value = value;
    }

    public static AccessibilityState of(int value) {
        return new AccessibilityState((float) value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.STATE, value));
    }
}
