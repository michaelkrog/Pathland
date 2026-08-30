package com.pathland.view;

/**
 * the accessibility label (a {@code STRING} property).
 */
public final class AccessibilityLabel implements ViewModifier {

    private final String value;

    private AccessibilityLabel(String value) {
        this.value = value;
    }

    public static AccessibilityLabel of(String value) {
        return new AccessibilityLabel(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.LABEL, value));
    }
}
