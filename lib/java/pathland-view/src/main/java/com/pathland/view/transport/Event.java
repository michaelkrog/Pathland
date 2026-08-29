package com.pathland.view.transport;

import com.pathland.view.Commands;

/**
 * A raw input event flowing host → guest through the opcode engine (an {@code EVENT}
 * opcode).
 *
 * <p>Transport-dependent payload per kind (see {@code spec/EVENTS.md}):
 * <ul>
 *   <li>pointer ({@code x}/{@code y}) — viewport-relative logical points;</li>
 *   <li>{@code VALUE_CHANGED} ({@code value}) — the control's semantic value;</li>
 *   <li>key ({@code b}/{@code c}) — keyCode / modifier bitmask;</li>
 *   <li>{@code DATE_CHANGED} ({@code b}/{@code c}) — days since epoch / millis of day;</li>
 *   <li>{@code TEXT_CHANGED} ({@code text}) — carried in the batch's string section;</li>
 *   <li>{@code SCROLL}/{@code WHEEL} ({@code x}/{@code y}) — offsets/deltas.</li>
 * </ul>
 */
public record Event(
        int command, int target, int flags, float x, float y, float value, String text, int b, int c) {

    public static Event pointerDown(int target, float x, float y) {
        return new Event(Commands.Event.POINTER_DOWN, target, 0, x, y, 0, null, 0, 0);
    }

    public static Event pointerUp(int target, float x, float y) {
        return new Event(Commands.Event.POINTER_UP, target, 0, x, y, 0, null, 0, 0);
    }

    public static Event pointerMove(int target, float x, float y, int flags) {
        return new Event(Commands.Event.POINTER_MOVE, target, flags, x, y, 0, null, 0, 0);
    }

    public static Event keyDown(int target, int keyCode, int modifiers, int flags) {
        return new Event(Commands.Event.KEY_DOWN, target, flags, 0, 0, 0, null, keyCode, modifiers);
    }

    public static Event keyUp(int target, int keyCode, int modifiers) {
        return new Event(Commands.Event.KEY_UP, target, 0, 0, 0, 0, null, keyCode, modifiers);
    }

    public static Event valueChanged(int target, float value) {
        return new Event(Commands.Event.VALUE_CHANGED, target, 0, 0, 0, value, null, 0, 0);
    }

    public static Event textChanged(int target, String text) {
        return new Event(Commands.Event.TEXT_CHANGED, target, 0, 0, 0, 0, text, 0, 0);
    }

    public static Event focusChanged(int target, boolean focused) {
        return new Event(Commands.Event.FOCUS_CHANGED, target, 0, 0, 0, 0, null, focused ? 1 : 0, 0);
    }

    public static Event editingChanged(int target, boolean editing) {
        return new Event(Commands.Event.EDITING_CHANGED, target, 0, 0, 0, 0, null, editing ? 1 : 0, 0);
    }

    public static Event submit(int target) {
        return new Event(Commands.Event.SUBMIT, target, 0, 0, 0, 0, null, 0, 0);
    }

    public static Event scroll(int target, float offsetX, float offsetY) {
        return new Event(Commands.Event.SCROLL, target, 0, offsetX, offsetY, 0, null, 0, 0);
    }

    public static Event wheel(int target, float deltaX, float deltaY) {
        return new Event(Commands.Event.WHEEL, target, 0, deltaX, deltaY, 0, null, 0, 0);
    }

    public static Event dateChanged(int target, int days, int millisOfDay) {
        return new Event(Commands.Event.DATE_CHANGED, target, 0, 0, 0, 0, null, days, millisOfDay);
    }

    public boolean isPointerDown() {
        return command == Commands.Event.POINTER_DOWN;
    }

    public boolean isPointerMove() {
        return command == Commands.Event.POINTER_MOVE;
    }

    public boolean isPointerUp() {
        return command == Commands.Event.POINTER_UP;
    }

    public boolean isKeyDown() {
        return command == Commands.Event.KEY_DOWN;
    }

    public boolean isKeyUp() {
        return command == Commands.Event.KEY_UP;
    }

    public boolean isValueChanged() {
        return command == Commands.Event.VALUE_CHANGED;
    }

    public boolean isTextChanged() {
        return command == Commands.Event.TEXT_CHANGED;
    }

    public boolean isFocusChanged() {
        return command == Commands.Event.FOCUS_CHANGED;
    }

    public boolean isEditingChanged() {
        return command == Commands.Event.EDITING_CHANGED;
    }

    public boolean isSubmit() {
        return command == Commands.Event.SUBMIT;
    }

    public boolean isScroll() {
        return command == Commands.Event.SCROLL;
    }

    public boolean isWheel() {
        return command == Commands.Event.WHEEL;
    }

    public boolean isDateChanged() {
        return command == Commands.Event.DATE_CHANGED;
    }

    /** For {@code KEY_*}: the canonical logical key code. */
    public int keyCode() {
        return b;
    }

    /** For {@code KEY_*}: the modifier bitmask (Shift=1, Control=2, Alt=4, Meta=8). */
    public int modifiers() {
        return c;
    }

    /** For {@code DATE_CHANGED}: days since epoch (I32). */
    public int days() {
        return b;
    }

    /** For {@code DATE_CHANGED}: millis of day (U32, 0..86,400,000). */
    public int millisOfDay() {
        return c;
    }
}