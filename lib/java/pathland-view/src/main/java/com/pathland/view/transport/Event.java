package com.pathland.view.transport;

import com.pathland.view.Commands;

/**
 * A raw input event flowing host → guest through the opcode engine (an {@code EVENT}
 * opcode). Pointer events carry coordinates; value controls carry a value; text inputs
 * carry the edited text (transported in the batch's string section).
 */
public record Event(
        int command, int target, int flags, float x, float y, float value, String text) {

    public static Event pointerDown(int target, float x, float y) {
        return new Event(Commands.Event.POINTER_DOWN, target, 0, x, y, 0, null);
    }

    public static Event pointerUp(int target, float x, float y) {
        return new Event(Commands.Event.POINTER_UP, target, 0, x, y, 0, null);
    }

    public static Event pointerMove(int target, float x, float y, int flags) {
        return new Event(Commands.Event.POINTER_MOVE, target, flags, x, y, 0, null);
    }

    public static Event valueChanged(int target, float value) {
        return new Event(Commands.Event.VALUE_CHANGED, target, 0, 0, 0, value, null);
    }

    public static Event textChanged(int target, String text) {
        return new Event(Commands.Event.TEXT_CHANGED, target, 0, 0, 0, 0, text);
    }

    public boolean isPointerDown() {
        return command == Commands.Event.POINTER_DOWN;
    }

    public boolean isPointerUp() {
        return command == Commands.Event.POINTER_UP;
    }

    public boolean isValueChanged() {
        return command == Commands.Event.VALUE_CHANGED;
    }

    public boolean isTextChanged() {
        return command == Commands.Event.TEXT_CHANGED;
    }
}