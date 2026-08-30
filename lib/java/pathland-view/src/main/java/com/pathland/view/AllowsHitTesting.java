package com.pathland.view;

/**
 * whether the view participates in hit testing.
 */
public final class AllowsHitTesting implements ViewModifier {

    private final boolean on;

    private AllowsHitTesting(boolean on) {
        this.on = on;
    }

    /** Hit-testing on ({@code on} = participates). */
    public static AllowsHitTesting of(boolean on) {
        return new AllowsHitTesting(on);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.ALLOWS_HIT_TESTING, on ? 1 : 0));
    }
}
