package com.pathland.view;

import com.pathland.view.emit.PathlandNode;
import com.pathland.view.signal.Signal;

/**
 * A composable view (SwiftUI ergonomics). Composite views declare their subtree with
 * {@link #body()}; the library's primitives (leaves, stacks, controls) instead override
 * {@link #render(Environment)} to materialize a {@link PathlandNode}. The interface is
 * open: the library ships the leaf primitives and modifier wrappers, and application
 * code (Quarkus, Spring Boot, desktop) defines its own views by implementing
 * {@code View} directly.
 *
 * <p>{@link #body()} is evaluated once at mount — reactivity comes from signals
 * ({@link Text#of(Signal)}, {@code Signals.computed}), not from body re-evaluation.
 *
 * <p>Global modifiers are chainable on any view. Constructor (structural/layout)
 * properties are passed to the view constructors and are never chainable; spacing
 * is a constructor property and {@code padding} is a modifier.
 */
public interface View {

    /**
     * SwiftUI-style composition: a composite view returns its subtree here. Primitives
     * return {@code this} (the identity body) and instead override
     * {@link #render(Environment)}.
     */
    default View body() {
        return this;
    }

    /**
     * Materialize this view into retained node(s). Composite views resolve
     * {@link #body()} first (recursively); primitives override this to build a
     * {@link PathlandNode}.
     */
    default PathlandNode render(Environment env) {
        com.pathland.view.state.PersistentState state = env.state();
        if (state != null) {
            state.connect(this); // wire this view's State fields (idempotent)
        }
        View resolved = body();
        if (resolved != this) {
            return resolved.render(env);
        }
        throw new UnsupportedOperationException(
                getClass().getName() + " must override body() (composite) or render() (primitive)");
    }

    // ------------------------------------------------------------------
    // Global modifiers
    // ------------------------------------------------------------------

    /** Pad the view on all sides (an {@code F32} property). */
    default View padding(int pixels) {
        return padding((float) pixels);
    }

    /** Pad the view on all sides (fractional). */
    default View padding(float pixels) {
        return modifier(Padding.of(pixels));
    }

    /** Pad the view by edge-specific amounts. */
    default View padding(int top, int right, int bottom, int left) {
        return modifier(Padding.of(top, right, bottom, left));
    }

    /** Set the foreground style/color (a {@code COLOR} property). SwiftUI {@code .foregroundStyle}; there is no {@code .color()} modifier. */
    default View foregroundStyle(Color color) {
        return modifier(ForegroundStyle.of(color));
    }

    /** Reactive foreground style: re-emits only this node's {@code COLOR} on change. */
    default View foregroundStyle(Signal<Color> color) {
        return modifier(ForegroundStyle.of(color));
    }

    /** Set the accent/tint color (a {@code TINT} property). */
    default View tint(Color color) {
        return modifier(Tint.of(color));
    }

    /** Set the background color (a {@code COLOR} property). */
    default View background(Color color) {
        return modifier(Background.of(color));
    }

    /** Reactive background color. */
    default View background(Signal<Color> color) {
        return modifier(Background.of(color));
    }

    /** Set opacity ({@code 0..1}). */
    default View opacity(float value) {
        return modifier(Opacity.of(value));
    }

    /** Set font size in points. */
    default View fontSize(float px) {
        return modifier(FontSize.of(px));
    }

    /** Reactive font size. */
    default View fontSize(Signal<Float> px) {
        return modifier(FontSize.of(px));
    }

    /** Set font weight. */
    default View fontWeight(FontWeight weight) {
        return modifier(FontWeightMod.of(weight));
    }

    /** Draw a border around the view (SwiftUI {@code .border(_:width:)}). */
    default View border(Color color, float width) {
        return modifier(Border.of(color, width));
    }

    /** Draw a border with a corner radius (a convenience; {@code color} first). */
    default View border(Color color, float width, float radius) {
        return modifier(Border.of(color, width, radius));
    }

    /** Draw a border around the view (deprecated order; use {@link #border(Color, float)}). */
    default View border(float width, Color color, float radius) {
        return border(color, width, radius);
    }

    /** Show/hide the view ({@code VISIBLE} is a {@code U8} property). */
    default View visible(boolean visible) {
        return modifier(Visible.of(visible));
    }

    /**
     * Compound sizing modifier. Pass {@link Commands.Size#FILL} / {@link Commands.Size#HUG_CONTENT}
     * for a fixed axis, or {@link Float#NaN} to leave it to the native renderer.
     */
    default View frame(float width, float height, Alignment alignment) {
        return modifier(FrameMod.of(width, height, alignment));
    }

    /** Compound min/ideal/max frame modifier. Pass {@link Float#NaN} for any unset bound. */
    default View frame(float minWidth, float idealWidth, float maxWidth,
                       float minHeight, float idealHeight, float maxHeight) {
        return modifier(FrameMod.of(minWidth, idealWidth, maxWidth, minHeight, idealHeight, maxHeight));
    }

    /** Translate the view after layout ({@code OFFSET_X} / {@code OFFSET_Y}). */
    default View offset(float x, float y) {
        return modifier(Offset.of(x, y));
    }

    /** Absolutely position the view within its parent ({@code POSITION_X} / {@code POSITION_Y}). */
    default View position(float x, float y) {
        return modifier(Position.of(x, y));
    }

    /** Fix the view to its intrinsic content size on both axes. */
    default View fixedSize() {
        return fixedSize(true, true);
    }

    /** Fix the view to its intrinsic content size per axis. */
    default View fixedSize(boolean horizontal, boolean vertical) {
        return modifier(FixedSize.of(horizontal, vertical));
    }

    /** Layout priority for stretching/shrinking within a parent. */
    default View layoutPriority(float value) {
        return modifier(LayoutPriority.of(value));
    }

    /** Draw-order elevation within a stack. */
    default View zIndex(float value) {
        return modifier(ZIndex.of(value));
    }

    /** Constrain the aspect ratio ({@code ASPECT_RATIO} + {@code CONTENT_MODE}). */
    default View aspectRatio(float ratio, ContentMode mode) {
        return modifier(AspectRatio.of(ratio, mode));
    }

    /** Fit the content within its bounds ({@code CONTENT_MODE=Fit}). */
    default View scaledToFit() {
        return modifier(ScaledToFit.of());
    }

    /** Fill its bounds, cropping overflow ({@code CONTENT_MODE=Fill}). */
    default View scaledToFill() {
        return modifier(ScaledToFill.of());
    }

    /** Minimum scale factor for text shrinking. */
    default View minimumScaleFactor(float value) {
        return modifier(MinimumScaleFactor.of(value));
    }

    /** Font style (normal / italic). */
    default View fontStyle(FontStyle style) {
        return modifier(FontStyleMod.of(style));
    }

    /** Italicize the text ({@code FONT_STYLE=Italic}). */
    default View italic() {
        return modifier(Italic.of());
    }

    /** Font design (default / serif / rounded / monospaced). */
    default View fontDesign(FontDesign design) {
        return modifier(FontDesignMod.of(design));
    }

    /** Font width (0.5–1.5, 1.0 default). */
    default View fontWidth(float value) {
        return modifier(FontWidth.of(value));
    }

    /** Per-glyph kerning in points. */
    default View kerning(float points) {
        return modifier(Kerning.of(points));
    }

    /** Uniform letter spacing in points. */
    default View tracking(float points) {
        return modifier(Tracking.of(points));
    }

    /** Baseline offset in points. */
    default View baselineOffset(float points) {
        return modifier(BaselineOffset.of(points));
    }

    /** Line spacing in points. */
    default View lineSpacing(float points) {
        return modifier(LineSpacing.of(points));
    }

    /** Limit the number of rendered lines ({@code 0} = unlimited). */
    default View lineLimit(int lines) {
        return modifier(LineLimit.of(lines));
    }

    /** Align the text block inside its own bounds. */
    default View multilineTextAlignment(TextAlignment alignment) {
        return modifier(TextAlignmentMod.of(alignment));
    }

    /** Truncation mode for overflowed text. */
    default View truncationMode(Truncation mode) {
        return modifier(TruncationMod.of(mode));
    }

    /** Text case transformation (none / uppercase / lowercase). */
    default View textCase(TextCase textCase) {
        return modifier(TextCaseMod.of(textCase));
    }

    /** Underline the text. */
    default View underline() {
        return underline(true);
    }

    /** Underline the text. */
    default View underline(boolean on) {
        return modifier(Underline.of(on));
    }

    /** Strikethrough the text. */
    default View strikethrough() {
        return strikethrough(true);
    }

    /** Strikethrough the text. */
    default View strikethrough(boolean on) {
        return modifier(Strikethrough.of(on));
    }

    /** Set the font family (a {@code STRING} property). */
    default View fontFamily(String family) {
        return modifier(FontFamily.of(family));
    }

    /** Round the corners of the view. */
    default View cornerRadius(float radius) {
        return modifier(CornerRadius.of(radius));
    }

    /** Compound shadow (color, radius, offset). Missing fields use renderer defaults. */
    default View shadow(Color color, float radius, float x, float y) {
        return modifier(Shadow.of(color, radius, x, y));
    }

    /** A shadow with just a radius (renderer-token color). */
    default View shadow(float radius) {
        return modifier(Shadow.of(radius));
    }

    /** Gaussian blur radius. */
    default View blur(float radius) {
        return modifier(Blur.of(radius));
    }

    /** Saturation filter ({@code 0..1}). */
    default View saturation(float value) {
        return modifier(Saturation.of(value));
    }

    /** Contrast filter ({@code 0..1}). */
    default View contrast(float value) {
        return modifier(Contrast.of(value));
    }

    /** Brightness filter ({@code -1..1}). */
    default View brightness(float value) {
        return modifier(Brightness.of(value));
    }

    /** Grayscale filter ({@code 0..1}). */
    default View grayscale(float value) {
        return modifier(Grayscale.of(value));
    }

    /** Hue rotation in degrees. */
    default View hueRotation(float degrees) {
        return modifier(HueRotation.of(degrees));
    }

    /** Multiply the view's color (a {@code COLOR} property). */
    default View colorMultiply(Color color) {
        return modifier(ColorMultiply.of(color));
    }

    /** Invert the view's colors. */
    default View colorInvert() {
        return modifier(ColorInvert.of());
    }

    /** Clip the view to its bounds. */
    default View clipped() {
        return modifier(Clipped.of());
    }

    /** Clip the view to a shape ({@code CLIPS_TO_BOUNDS} + {@code SHAPE_KIND}). */
    default View clipShape(ShapeKind kind) {
        return modifier(ClipShape.of(kind));
    }

    /** Rotate the view after layout, in degrees (counter-clockwise). */
    default View rotation(float degrees) {
        return modifier(Rotation.of(degrees));
    }

    /** Uniformly scale the view after layout. */
    default View scaleEffect(float value) {
        return modifier(ScaleEffect.of(value));
    }

    /** Hide the view ({@code VISIBLE}=0). */
    default View hidden() {
        return modifier(Hidden.of());
    }

    /** Disable/enable the view ({@code ENABLED}: 1 = interactive). */
    default View disabled(boolean disabled) {
        return modifier(Disabled.of(disabled));
    }

    /** Whether the view participates in hit testing. */
    default View allowsHitTesting(boolean on) {
        return modifier(AllowsHitTesting.of(on));
    }

    /** Control size (small / regular / large). */
    default View controlSize(ControlSize size) {
        return modifier(ControlSizeMod.of(size));
    }

    /** The accessibility label (a {@code STRING} property). */
    default View accessibilityLabel(String label) {
        return modifier(AccessibilityLabel.of(label));
    }

    /** The accessibility role (semantic enum code). */
    default View accessibilityRole(int role) {
        return modifier(AccessibilityRole.of(role));
    }

    /** The accessibility state (semantic enum code). */
    default View accessibilityState(int state) {
        return modifier(AccessibilityState.of(state));
    }

    /** Set the image source (a {@code STRING} property). */
    default View imageSource(String source) {
        return modifier(ImageSource.of(source));
    }

    /** Declare which raw events this node wants reported (the {@code EVENT_LISTENERS} bitmask). */
    default View pointerEvents(int mask) {
        return modifier(PointerEvents.of(mask));
    }

    /** Set the action callback id (gates tap/action event delivery on the wire). */
    default View actionId(int id) {
        return modifier(ActionId.of(id));
    }

    /** Set the two-way binding id (gates value/text event delivery on the wire). */
    default View bindingId(int id) {
        return modifier(BindingId.of(id));
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
        return modifier(TapGesture.of(action));
    }
}