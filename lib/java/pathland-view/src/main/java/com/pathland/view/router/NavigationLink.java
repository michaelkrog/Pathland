package com.pathland.view.router;

import com.pathland.view.Button;
import com.pathland.view.Environment;
import com.pathland.view.Text;
import com.pathland.view.View;
import com.pathland.view.emit.PathlandNode;

import java.util.Objects;

/**
 * A tappable link that {@link Router#push(String) pushes} a route onto the
 * back-stack (spec DSL.md §4.5). Renders through the active {@code ButtonStyle}
 * as a native {@code BUTTON}; its tap action is routed via the emitter's tap-action
 * registry exactly like a button.
 */
public final class NavigationLink implements View {

    private final View button;

    private NavigationLink(View label, Router router, String to) {
        Objects.requireNonNull(router, "router");
        Objects.requireNonNull(to, "to");
        this.button = Button.of(label, () -> router.push(to));
    }

    /** A link with a plain text title. */
    public static NavigationLink of(String label, Router router, String to) {
        return new NavigationLink(Text.of(label), router, to);
    }

    /** A link with an arbitrary child view as its label. */
    public static NavigationLink of(View label, Router router, String to) {
        return new NavigationLink(label, router, to);
    }

    @Override
    public PathlandNode render(Environment env) {
        return button.render(env);
    }
}