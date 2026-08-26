package com.pathland.view;

/**
 * A button style (SwiftUI {@code ButtonStyle}). A style turns a button's
 * {@link Configuration} (its label + action) into a decorated body view. Styles are
 * injected down the tree via {@link View#buttonStyle(ButtonStyle)}.
 */
public interface ButtonStyle {

    /** Build the styled button body for {@code config}. */
    View makeBody(Configuration config);

    /**
     * The configuration of the button being styled: its label and its action. The
     * returned body is expected to attach the tap gesture wired to {@code action}.
     */
    record Configuration(View label, Runnable action) {}
}