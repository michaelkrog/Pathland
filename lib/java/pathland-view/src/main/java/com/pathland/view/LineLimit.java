package com.pathland.view;

/**
 * limits the number of rendered lines ({@code 0} = unlimited).
 */
public final class LineLimit implements ViewModifier {

    private final int lines;

    private LineLimit(int lines) {
        this.lines = lines;
    }

    /** Line limit ({@code 0} = unlimited). */
    public static LineLimit of(int lines) {
        return new LineLimit(lines);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.LINE_LIMIT, lines));
    }
}
