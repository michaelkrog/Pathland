package com.pathland.view.router;

import com.pathland.view.View;
import com.pathland.view.ViewModifier;

/**
 * The navigation action modifier (spec DSL.md §4.5 "any component can change the
 * route"): applied via {@code View#navigate/push/replace} to mark a view as a
 * route-changer. The intent is resolved to the nearest enclosing {@link Router} by
 * the emitter, so no router is threaded by hand:
 *
 * <pre>{@code
 * Button.of("Go to kitchen").navigate("/kitchen");   // direct selection
 * Button.of("Open item").push("/item/1");            // drill-down (back-stack)
 * Button.of("Swap").replace("/settings");            // guard redirect / replace
 * }</pre>
 */
public final class NavigationMod implements ViewModifier {

    private final String to;
    private final NavOp op;

    private NavigationMod(String to, NavOp op) {
        this.to = to;
        this.op = op;
    }

    /** A {@link NavOp#NAVIGATE} route-change to {@code to}. */
    public static NavigationMod navigate(String to) {
        return new NavigationMod(to, NavOp.NAVIGATE);
    }

    /** A {@link NavOp#PUSH} route-change to {@code to} (drill-down). */
    public static NavigationMod push(String to) {
        return new NavigationMod(to, NavOp.PUSH);
    }

    /** A {@link NavOp#REPLACE} route-change to {@code to}. */
    public static NavigationMod replace(String to) {
        return new NavigationMod(to, NavOp.REPLACE);
    }

    @Override
    public View body(View content) {
        return new NavigationModView(content, to, op);
    }
}