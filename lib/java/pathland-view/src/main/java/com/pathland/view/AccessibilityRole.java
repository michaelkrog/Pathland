package com.pathland.view;

/**
 * the accessibility role ({@code ROLE} semantic enum code).
 */
public final class AccessibilityRole implements ViewModifier {

    private final float value;

    private AccessibilityRole(float value) {
        this.value = value;
    }

    public static AccessibilityRole of(int value) {
        return new AccessibilityRole((float) value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.ROLE, value));
    }
}
