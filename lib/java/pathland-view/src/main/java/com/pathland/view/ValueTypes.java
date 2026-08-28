package com.pathland.view;

/** Value types for {@code STYLE::SET_PROPERTY} (mirrors {@code pathland_core::value_type}). */
public final class ValueTypes {

    public static final int U8 = 0x01;
    public static final int U32 = 0x02;
    public static final int I32 = 0x03;
    public static final int F32 = 0x04;
    public static final int STRING = 0x05;
    public static final int ENUM = 0x06;
    public static final int COLOR = 0x07;
    public static final int DESIGN_TOKEN = 0x08;

    /** The protocol value type for a property id (mirrors {@code value_type_for}). */
    public static int forProperty(int prop) {
        return switch (prop) {
            case Properties.COLOR, Properties.BACKGROUND_COLOR, Properties.BORDER_COLOR -> COLOR;
            case Properties.EVENT_LISTENERS, Properties.BORDER_EDGES -> U32;
            case Properties.SELECTED -> U8;
            case Properties.LABEL, Properties.PROMPT, Properties.FONT_FAMILY -> STRING;
            case Properties.LINE_LIMIT -> U32;
            default -> F32;
        };
    }

    private ValueTypes() {}
}