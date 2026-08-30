package com.pathland.view;

/**
 * the action callback id ({@code ACTION_ID}).
 */
public final class ActionId implements ViewModifier {

    private final int value;

    private ActionId(int value) {
        this.value = value;
    }

    public static ActionId of(int value) {
        return new ActionId(value);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.ACTION_ID, value));
    }
}
