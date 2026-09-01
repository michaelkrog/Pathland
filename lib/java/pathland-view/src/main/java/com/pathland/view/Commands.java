package com.pathland.view;

/** Commands per category (mirrors {@code pathland_core::tree/style/event/meta}). */
public final class Commands {

    private Commands() {}

    /** TREE commands. */
    public static final class Tree {
        public static final int CREATE_NODE = 0x01;
        public static final int DELETE_NODE = 0x02;
        public static final int INSERT_CHILD = 0x03;
        public static final int REMOVE_CHILD = 0x04;
        public static final int MOVE_CHILD = 0x05;
        private Tree() {}
    }

    /** STYLE commands. */
    public static final class Style {
        public static final int SET_PROPERTY = 0x01;
        public static final int SET_DESIGN_TOKEN = 0x02;
        public static final int SET_TEXT = 0x03;
        public static final int SET_DATE = 0x04;
        private Style() {}
    }

    /** EVENT commands (host → guest raw inputs). */
    public static final class Event {
        public static final int POINTER_DOWN = 0x01;
        public static final int POINTER_MOVE = 0x02;
        public static final int POINTER_UP = 0x03;
        public static final int KEY_DOWN = 0x04;
        public static final int KEY_UP = 0x05;
        public static final int VALUE_CHANGED = 0x06;
        public static final int TEXT_CHANGED = 0x07;
        public static final int FOCUS_CHANGED = 0x08;
        public static final int EDITING_CHANGED = 0x09;
        public static final int SUBMIT = 0x0A;
        public static final int SCROLL = 0x0B;
        public static final int WHEEL = 0x0C;
        public static final int DATE_CHANGED = 0x0D;
        private Event() {}
    }

    /** META commands. */
public static final class Meta {
            public static final int RESET = 0x01;
            public static final int ENVIRONMENT = 0x02;
            /** The host (renderer) requests a full snapshot of the current tree (host → guest). */
            public static final int RESYNC = 0x03;
            private Meta() {}
        }

    /** Flag bits shared across categories. */
    public static final class Flags {
        public static final int POINTER_SECONDARY = 0x0001;
        public static final int HOVER_ENTER = 0x0001;
        public static final int HOVER_LEAVE = 0x0002;
        public static final int KEY_REPEAT = 0x0002;
        private Flags() {}
    }

    /** Bits for the {@code EVENT_LISTENERS} semantic property. */
    public static final class Listeners {
        public static final int POINTER_DOWN = 1 << 0;
        public static final int POINTER_MOVE = 1 << 1;
        public static final int POINTER_UP = 1 << 2;
        public static final int KEY_DOWN = 1 << 3;
        public static final int KEY_UP = 1 << 4;
        public static final int FOCUS = 1 << 5;
        public static final int EDITING = 1 << 6;
        public static final int SUBMIT = 1 << 7;
        public static final int SCROLL = 1 << 8;
        public static final int WHEEL = 1 << 9;
        public static final int POINTER = POINTER_DOWN | POINTER_MOVE | POINTER_UP;
        private Listeners() {}
    }

    /** Special size constants for WIDTH / HEIGHT. */
    public static final class Size {
        public static final float FILL = -1f;
        public static final float HUG_CONTENT = -2f;
        private Size() {}
    }
}