package com.pathland.view.router;

import com.pathland.view.Button;
import com.pathland.view.Environment;
import com.pathland.view.Text;
import com.pathland.view.View;
import com.pathland.view.emit.PathlandNode;

import java.util.Objects;

/**
 * A tappable link that changes the route (spec DSL.md §4.5). With an explicit
 * {@link Router} it {@link Router#push(String) pushes} onto that router's
 * back-stack; the router-agnostic overloads ({@code NavigationLink.of(label, to)})
 * declare a {@link NavOp#PUSH} intent that the emitter resolves to the **nearest
 * enclosing** {@link Router} — no router is threaded by hand. Renders through the
 * active {@code ButtonStyle} as a native {@code BUTTON}; its tap action is routed
 * via the emitter's tap/navigate-action registry exactly like a button.
 */
public final class NavigationLink implements View {

    private final View button;

    private NavigationLink(View label, Router router, String to) {
        Objects.requireNonNull(router, "router");
        Objects.requireNonNull(to, "to");
        this.button = Button.of(label, () -> router.push(to));
    }

    private NavigationLink(View label, String to) {
        Objects.requireNonNull(to, "to");
        // The tap's real effect is the declared navigation intent (`.push`), which the
        // host routes via navigateActions before tapActions; the button action is a
        // no-op placeholder (Button requires one).
        this.button = Button.of(label, () -> {}).push(to);
    }

    /** A link with a plain text title. */
    public static NavigationLink of(String label, Router router, String to) {
        return new NavigationLink(Text.of(label), router, to);
    }

    /** A link with an arbitrary child view as its label. */
    public static NavigationLink of(View label, Router router, String to) {
        return new NavigationLink(label, router, to);
    }

    /** A router-agnostic link (push intent resolved to the nearest enclosing router). */
    public static NavigationLink of(String label, String to) {
        return new NavigationLink(Text.of(label), to);
    }

    /** A router-agnostic link with an arbitrary child view as its label. */
    public static NavigationLink of(View label, String to) {
        return new NavigationLink(label, to);
    }

    @Override
    public PathlandNode render(Environment env) {
        return button.render(env);
    }
}