package com.pathland.view;

/** Protocol property ids (mirrors {@code pathland_core::property_id}). */
public final class Properties {

    // Stack
    public static final int SPACING = 0x0001;
    public static final int ALIGNMENT = 0x0002;
    public static final int CONTENT_MARGINS = 0x0005;
    // Shape
    public static final int SHAPE_KIND = 0x0006;
    // Text
    public static final int TEXT = 0x000A;
    public static final int LINE_LIMIT = 0x000B;
    public static final int TEXT_ALIGNMENT = 0x000C;
    public static final int TRUNCATION_MODE = 0x000D;
    // Style (0x1000 range)
    public static final int BACKGROUND_COLOR = 0x1001;
    public static final int BORDER_WIDTH = 0x1003;
    public static final int BORDER_COLOR = 0x1004;
    public static final int BORDER_RADIUS = 0x1005;
    public static final int FONT_SIZE = 0x1007;
    public static final int FONT_WEIGHT = 0x1008;
    public static final int FONT_FAMILY = 0x1009;
    public static final int COLOR = 0x100A;
    public static final int WIDTH = 0x100B;
    public static final int HEIGHT = 0x100C;
    public static final int OPACITY = 0x100D;
    public static final int VISIBLE = 0x100E;
    public static final int Z_INDEX = 0x100F;
    public static final int CLIPS_TO_BOUNDS = 0x1010;
    public static final int PADDING = 0x1011;
    public static final int PADDING_TOP = 0x1012;
    public static final int PADDING_RIGHT = 0x1013;
    public static final int PADDING_BOTTOM = 0x1014;
    public static final int PADDING_LEFT = 0x1015;
    public static final int BORDER_EDGES = 0x1016;
    public static final int TINT = 0x1030;
    // Semantic (0x2000 range)
    public static final int ROLE = 0x2001;
    public static final int STATE = 0x2002;
    public static final int ENABLED = 0x2003;
    public static final int SELECTED = 0x2004;
    public static final int EVENT_LISTENERS = 0x2005;
    public static final int VALUE = 0x2006;
    public static final int MIN_VALUE = 0x2007;
    public static final int MAX_VALUE = 0x2008;
    public static final int LABEL = 0x200A;
    public static final int PROMPT = 0x200B;
    // Control properties
    public static final int TOGGLE_STYLE = 0x2018;

    private Properties() {}
}