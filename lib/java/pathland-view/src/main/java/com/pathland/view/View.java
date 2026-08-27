package com.pathland.view;

import com.pathland.view.emit.PathlandNode;
import com.pathland.view.signal.Signal;

import java.util.List;

/**
 * A composable view (SwiftUI ergonomics). Implementations build a
 * {@link PathlandNode} subtree via {@link #render(Environment)}. The interface is open:
 * the library ships the leaf primitives, layout stacks, interactive controls, and
 * modifier wrappers, and application code (Quarkus, Spring Boot, desktop) defines its
 * own views by implementing {@code View} directly.
 *
 * <p>Global modifiers are chainable on any view. Constructor (structural/layout)
 * properties are passed to the view constructors and are never chainable; spacing
 * is a constructor property and {@code padding} is a modifier.
 */
public interface View {

    /** Build this view's retained node(s). */
    PathlandNode render(Environment env);

    // ------------------------------------------------------------------
    // Global modifiers
    // ------------------------------------------------------------------

    /** Pad the view on all sides (an {@code F32} property). */
    default View padding(int pixels) {
        return padding((float) pixels);
    }

    /** Pad the view on all sides (fractional). */
    default View padding(float pixels) {
        return Modified.props(this, Modified.prop(Properties.PADDING, pixels));
    }

    /** Pad the view by edge-specific amounts. */
    default View padding(int top, int right, int bottom, int left) {
        return Modified.props(
                this,
                Modified.prop(Properties.PADDING_TOP, (float) top),
                Modified.prop(Properties.PADDING_RIGHT, (float) right),
                Modified.prop(Properties.PADDING_BOTTOM, (float) bottom),
                Modified.prop(Properties.PADDING_LEFT, (float) left));
    }

    /** Set the foreground color (a {@code COLOR} property). */
    default View color(Color color) {
        return Modified.props(this, Modified.prop(Properties.COLOR, color));
    }

    /** Reactive foreground color: re-emits only this node's {@code COLOR} on change. */
    default View color(Signal<Color> color) {
        return Modified.props(this, Modified.prop(Properties.COLOR, color));
    }

    /** Set the background color (a {@code COLOR} property). */
    default View background(Color color) {
        return Modified.props(this, Modified.prop(Properties.BACKGROUND_COLOR, color));
    }

    /** Reactive background color. */
    default View background(Signal<Color> color) {
        return Modified.props(this, Modified.prop(Properties.BACKGROUND_COLOR, color));
    }

    /** Set opacity ({@code 0..1}). */
    default View opacity(float value) {
        return Modified.props(this, Modified.prop(Properties.OPACITY, value));
    }

    /** Set font size in points. */
    default View fontSize(float px) {
        return Modified.props(this, Modified.prop(Properties.FONT_SIZE, px));
    }

    /** Reactive font size. */
    default View fontSize(Signal<Float> px) {
        return Modified.props(this, Modified.prop(Properties.FONT_SIZE, px));
    }

    /** Set font weight. */
    default View fontWeight(FontWeight weight) {
        return Modified.props(this, Modified.prop(Properties.FONT_WEIGHT, (float) weight.wire()));
    }

    /** Draw a border around the view. */
    default View border(float width, Color color, float radius) {
        return Modified.props(
                this,
                Modified.prop(Properties.BORDER_WIDTH, width),
                Modified.prop(Properties.BORDER_COLOR, color),
                Modified.prop(Properties.BORDER_RADIUS, radius));
    }

    /** Show/hide the view. */
    default View visible(boolean visible) {
        return Modified.props(this, Modified.prop(Properties.VISIBLE, visible ? 1f : 0f));
    }

    /**
     * Compound sizing modifier. Pass {@link Commands.Size#FILL} / {@link Commands.Size#HUG_CONTENT}
     * for a fixed axis, or {@link Float#NaN} to leave it to the native renderer.
     */
    default View frame(float width, float height, Alignment alignment) {
        return Modified.props(
                this,
                Modified.prop(Properties.WIDTH, width),
                Modified.prop(Properties.HEIGHT, height),
                Modified.prop(Properties.ALIGNMENT, (float) alignment.wire()));
    }

    /** Wrap this view in a custom modifier (SwiftUI {@code .modifier}). */
    default View modifier(ViewModifier modifier) {
        return Modified.modifier(this, modifier);
    }

    /**
     * Scope a {@link ButtonStyle} down this view's subtree using a ScopedValue. Every
     * {@link Button} below this view renders its label through the style's
     * {@code makeBody}.
     */
    default View buttonStyle(ButtonStyle style) {
        return new ButtonStyleView(this, style);
    }

    /**
     * Attach a tap gesture (SwiftUI {@code onTapGesture}). Declares the pointer
     * down/up {@code EVENT_LISTENERS} and records the action for the built node so the
     * host can route a recognized tap back to it.
     */
    default View onTapGesture(Runnable action) {
        return new TapGestureView(this, action);
    }

    // ------------------------------------------------------------------
    // Static entry points
    // ------------------------------------------------------------------

    /** A {@code Text} leaf with static content. */
    static Text text(String content) {
        return Text.of(content);
    }

    /** A {@code Text} leaf bound to a reactive signal. */
    static Text text(Signal<String> binding) {
        return Text.of(binding);
    }

    /** An {@code Image} leaf. */
    static Image image() {
        return new Image();
    }

    /** A {@code Rectangle} shape. */
    static Rectangle rectangle() {
        return new Rectangle();
    }

    /** A {@code Spacer} (flexible space). */
    static Spacer spacer() {
        return new Spacer();
    }

    /** A vertical stack. */
    static VStack vstack(View... children) {
        return new VStack(children);
    }

    /** A vertical stack with constructor layout properties. */
    static VStack vstack(Alignment alignment, float spacing, View... children) {
        return new VStack(alignment, spacing, children);
    }

    /** A horizontal stack. */
    static HStack hstack(View... children) {
        return new HStack(children);
    }

    /** A horizontal stack with constructor layout properties. */
    static HStack hstack(Alignment alignment, float spacing, View... children) {
        return new HStack(alignment, spacing, children);
    }

    /** An overlapping stack. */
    static ZStack zstack(View... children) {
        return new ZStack(children);
    }

    /** A button with a string title. */
    static Button button(String title, Runnable action) {
        return new Button(title, action);
    }

    /** A button with an arbitrary child view as its label. */
    static Button button(View label, Runnable action) {
        return new Button(label, action);
    }

    /** A text field bound to a writable signal. */
    static TextField textField(String placeholder, com.pathland.view.signal.WritableSignal<String> binding) {
        return new TextField(placeholder, binding);
    }

    /** Compose a list of child views into one {@link View}. */
    static View group(List<View> children) {
        return vstack(children.toArray(new View[0]));
    }
}