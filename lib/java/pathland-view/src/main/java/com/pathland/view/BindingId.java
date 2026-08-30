package com.pathland.view;

/**
 * the two-way binding id ({@code BINDING_ID}).
 */
public final class BindingId implements ViewModifier {

    private final int value;

    private BindingId(int value) {
        this.value = value;
    }

    public static BindingId of(int value) {
        return new BindingId(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.BINDING_ID, value));
    }
}
