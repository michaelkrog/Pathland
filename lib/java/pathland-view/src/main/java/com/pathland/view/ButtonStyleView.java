package com.pathland.view;

import com.pathland.view.emit.PathlandNode;


/**
 * A view scoped to a {@link ButtonStyle} via a ScopedValue: the style is bound only
 * for this subtree's render, so buttons below inherit it without threading a parameter
 * through every {@link View#render} call.
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
        try {
            return ScopedValue.where(Environment.BUTTON_STYLE, style).call(() -> content.render(env));
        } catch (Exception e) {
            throw new IllegalStateException("buttonStyle scoped render failed", e);
        }
    }
}