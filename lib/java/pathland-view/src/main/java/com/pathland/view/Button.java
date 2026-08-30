package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

/**
 * An interactive button (SwiftUI {@code Button}). Accepts an arbitrary child view as
 * the label. The button renders through the {@link ButtonStyle} active in the
 * environment, which decorates the label and attaches the tap gesture wired to
 * {@code action}.
 */
public final class Button implements View {

    private final View label;
    private final Runnable action;

    private Button(String title, Runnable action) {
        this(Text.of(title), action);
    }

    private Button(View label, Runnable action) {
        this.label = label;
        this.action = action;
    }

    /** A button with a plain text title. */
    public static Button of(String title, Runnable action) {
        return new Button(title, action);
    }

    /** A button with an arbitrary child view as its label. */
    public static Button of(View label, Runnable action) {
        return new Button(label, action);
    }

    @Override
    public PathlandNode render(Environment env) {
        ButtonStyle style = env.buttonStyle();
        View body = style.makeBody(new ButtonStyle.Configuration(label, action));
        PathlandNode node = body.render(env);
        // The styled body (decorated label + tap gesture) becomes a native BUTTON
        // component: it keeps the label text, the style's property decorations, and
        // the tap listeners/action wired by the style.
        node.component = Components.BUTTON;
        return node;
    }
}