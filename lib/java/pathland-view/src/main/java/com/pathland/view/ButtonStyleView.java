package com.pathland.view;

import com.pathland.view.emit.PathlandNode;


/**
 * A view scoped to a {@link ButtonStyle} via a thread-local environment value: the style is
 * bound only for this subtree's render, so buttons below inherit it without threading a
 * parameter through every {@link View#render} call.
 */
final class ButtonStyleView implements View {

    private final View content;
    private final ButtonStyle style;

    ButtonStyleView(View content, ButtonStyle style) {
        this.content = content;
        this.style = style;
    }

    @Override
    public PathlandNode render(Environment env) {
        ButtonStyle previous = Environment.BUTTON_STYLE.get();
        Environment.BUTTON_STYLE.set(style);
        try {
            return content.render(env);
        } finally {
            if (previous == null) {
                Environment.BUTTON_STYLE.remove();
            } else {
                Environment.BUTTON_STYLE.set(previous);
            }
        }
    }
}