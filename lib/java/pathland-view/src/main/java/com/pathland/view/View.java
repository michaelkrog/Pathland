package com.pathland.view;

import com.pathland.view.emit.PathlandNode;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.WritableSignal;

import java.util.List;

/**
 * A composable view (SwiftUI ergonomics). Composite views declare their subtree with
 * {@link #body()}; the library's primitives (leaves, stacks, controls) instead override
 * {@link #render(Environment)} to materialize a {@link PathlandNode}. The interface is
 * open: the library ships the leaf primitives and modifier wrappers, and application
 * code (Quarkus, Spring Boot, desktop) defines its own views by implementing
 * {@code View} directly.
 *
 * <p>{@link #body()} is evaluated once at mount — reactivity comes from signals
 * ({@link #text(Signal)}, {@code Signals.computed}), not from body re-evaluation.
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

    /** Set the foreground style/color (a {@code COLOR} property). SwiftUI {@code .foregroundStyle}; there is no {@code .color()} modifier. */
    default View foregroundStyle(Color color) {
        return Modified.props(this, Modified.prop(Properties.COLOR, color));
    }

    /** Reactive foreground style: re-emits only this node's {@code COLOR} on change. */
    default View foregroundStyle(Signal<Color> color) {
        return Modified.props(this, Modified.prop(Properties.COLOR, color));
    }

    /** Set the accent/tint color (a {@code TINT} property). */
    default View tint(Color color) {
        return Modified.props(this, Modified.prop(Properties.TINT, color));
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

    /** Show/hide the view ({@code VISIBLE} is a {@code U8} property). */
    default View visible(boolean visible) {
        return Modified.props(this, Modified.prop(Properties.VISIBLE, visible ? 1 : 0));
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

    /** Compound min/ideal/max frame modifier. Pass {@link Float#NaN} for any unset bound. */
    default View frame(float minWidth, float idealWidth, float maxWidth,
                       float minHeight, float idealHeight, float maxHeight) {
        java.util.List<Modified.Prop> props = new java.util.ArrayList<>();
        addFrameBound(props, Properties.MIN_WIDTH, minWidth);
        addFrameBound(props, Properties.IDEAL_WIDTH, idealWidth);
        addFrameBound(props, Properties.MAX_WIDTH, maxWidth);
        addFrameBound(props, Properties.MIN_HEIGHT, minHeight);
        addFrameBound(props, Properties.IDEAL_HEIGHT, idealHeight);
        addFrameBound(props, Properties.MAX_HEIGHT, maxHeight);
        return Modified.props(this, props.toArray(new Modified.Prop[0]));
    }

    private static void addFrameBound(java.util.List<Modified.Prop> props, int property, float value) {
        if (!Float.isNaN(value)) {
            props.add(Modified.prop(property, value));
        }
    }

    /** Translate the view after layout ({@code OFFSET_X} / {@code OFFSET_Y}). */
    default View offset(float x, float y) {
        return Modified.props(
                this,
                Modified.prop(Properties.OFFSET_X, x),
                Modified.prop(Properties.OFFSET_Y, y));
    }

    /** Absolutely position the view within its parent ({@code POSITION_X} / {@code POSITION_Y}). */
    default View position(float x, float y) {
        return Modified.props(
                this,
                Modified.prop(Properties.POSITION_X, x),
                Modified.prop(Properties.POSITION_Y, y));
    }

    /** Fix the view to its intrinsic content size on both axes. */
    default View fixedSize() {
        return fixedSize(true, true);
    }

    /** Fix the view to its intrinsic content size per axis. */
    default View fixedSize(boolean horizontal, boolean vertical) {
        return Modified.props(
                this,
                Modified.prop(Properties.FIXED_SIZE_HORIZONTAL, horizontal ? 1 : 0),
                Modified.prop(Properties.FIXED_SIZE_VERTICAL, vertical ? 1 : 0));
    }

    /** Layout priority for stretching/shrinking within a parent. */
    default View layoutPriority(float value) {
        return Modified.props(this, Modified.prop(Properties.LAYOUT_PRIORITY, value));
    }

    /** Draw-order elevation within a stack. */
    default View zIndex(float value) {
        return Modified.props(this, Modified.prop(Properties.Z_INDEX, value));
    }

    /** Constrain the aspect ratio ({@code ASPECT_RATIO} + {@code CONTENT_MODE}). */
    default View aspectRatio(float ratio, ContentMode mode) {
        return Modified.props(
                this,
                Modified.prop(Properties.ASPECT_RATIO, ratio),
                Modified.prop(Properties.CONTENT_MODE, (float) mode.wire()));
    }

    /** Fit the content within its bounds ({@code CONTENT_MODE=Fit}). */
    default View scaledToFit() {
        return Modified.props(this, Modified.prop(Properties.CONTENT_MODE, (float) ContentMode.FIT.wire()));
    }

    /** Fill its bounds, cropping overflow ({@code CONTENT_MODE=Fill}). */
    default View scaledToFill() {
        return Modified.props(this, Modified.prop(Properties.CONTENT_MODE, (float) ContentMode.FILL.wire()));
    }

    /** Minimum scale factor for text shrinking. */
    default View minimumScaleFactor(float value) {
        return Modified.props(this, Modified.prop(Properties.MINIMUM_SCALE_FACTOR, value));
    }

    /** Font style (normal / italic). */
    default View fontStyle(FontStyle style) {
        return Modified.props(this, Modified.prop(Properties.FONT_STYLE, (float) style.wire()));
    }

    /** Italicize the text ({@code FONT_STYLE=Italic}). */
    default View italic() {
        return Modified.props(this, Modified.prop(Properties.FONT_STYLE, (float) FontStyle.ITALIC.wire()));
    }

    /** Font design (default / serif / rounded / monospaced). */
    default View fontDesign(FontDesign design) {
        return Modified.props(this, Modified.prop(Properties.FONT_DESIGN, (float) design.wire()));
    }

    /** Font width (0.5–1.5, 1.0 default). */
    default View fontWidth(float value) {
        return Modified.props(this, Modified.prop(Properties.FONT_WIDTH, value));
    }

    /** Per-glyph kerning in points. */
    default View kerning(float points) {
        return Modified.props(this, Modified.prop(Properties.KERNING, points));
    }

    /** Uniform letter spacing in points. */
    default View tracking(float points) {
        return Modified.props(this, Modified.prop(Properties.TRACKING, points));
    }

    /** Baseline offset in points. */
    default View baselineOffset(float points) {
        return Modified.props(this, Modified.prop(Properties.BASELINE_OFFSET, points));
    }

    /** Line spacing in points. */
    default View lineSpacing(float points) {
        return Modified.props(this, Modified.prop(Properties.LINE_SPACING, points));
    }

    /** Limit the number of rendered lines ({@code 0} = unlimited). */
    default View lineLimit(int lines) {
        return Modified.props(this, Modified.prop(Properties.LINE_LIMIT, lines));
    }

    /** Align the text block inside its own bounds. */
    default View multilineTextAlignment(TextAlignment alignment) {
        return Modified.props(this, Modified.prop(Properties.TEXT_ALIGNMENT, (float) alignment.wire()));
    }

    /** Truncation mode for overflowed text. */
    default View truncationMode(Truncation mode) {
        return Modified.props(this, Modified.prop(Properties.TRUNCATION_MODE, (float) mode.wire()));
    }

    /** Text case transformation (none / uppercase / lowercase). */
    default View textCase(TextCase textCase) {
        return Modified.props(this, Modified.prop(Properties.TEXT_CASE, (float) textCase.wire()));
    }

    /** Underline the text. */
    default View underline() {
        return underline(true);
    }

    /** Underline the text. */
    default View underline(boolean on) {
        return Modified.props(this, Modified.prop(Properties.UNDERLINE, on ? 1 : 0));
    }

    /** Strikethrough the text. */
    default View strikethrough() {
        return strikethrough(true);
    }

    /** Strikethrough the text. */
    default View strikethrough(boolean on) {
        return Modified.props(this, Modified.prop(Properties.STRIKETHROUGH, on ? 1 : 0));
    }

    /** Set the font family (a {@code STRING} property). */
    default View fontFamily(String family) {
        return Modified.props(this, Modified.prop(Properties.FONT_FAMILY, family));
    }

    /** Round the corners of the view. */
    default View cornerRadius(float radius) {
        return Modified.props(this, Modified.prop(Properties.BORDER_RADIUS, radius));
    }

    /** Compound shadow (color, radius, offset). Missing fields use renderer defaults. */
    default View shadow(Color color, float radius, float x, float y) {
        return Modified.props(
                this,
                Modified.prop(Properties.SHADOW_COLOR, color),
                Modified.prop(Properties.SHADOW_RADIUS, radius),
                Modified.prop(Properties.SHADOW_X, x),
                Modified.prop(Properties.SHADOW_Y, y));
    }

    /** A shadow with just a radius (renderer-token color). */
    default View shadow(float radius) {
        return Modified.props(this, Modified.prop(Properties.SHADOW_RADIUS, radius));
    }

    /** Gaussian blur radius. */
    default View blur(float radius) {
        return Modified.props(this, Modified.prop(Properties.BLUR_RADIUS, radius));
    }

    /** Saturation filter ({@code 0..1}). */
    default View saturation(float value) {
        return Modified.props(this, Modified.prop(Properties.SATURATION, value));
    }

    /** Contrast filter ({@code 0..1}). */
    default View contrast(float value) {
        return Modified.props(this, Modified.prop(Properties.CONTRAST, value));
    }

    /** Brightness filter ({@code -1..1}). */
    default View brightness(float value) {
        return Modified.props(this, Modified.prop(Properties.BRIGHTNESS, value));
    }

    /** Grayscale filter ({@code 0..1}). */
    default View grayscale(float value) {
        return Modified.props(this, Modified.prop(Properties.GRAYSCALE, value));
    }

    /** Hue rotation in degrees. */
    default View hueRotation(float degrees) {
        return Modified.props(this, Modified.prop(Properties.HUE_ROTATION, degrees));
    }

    /** Multiply the view's color (a {@code COLOR} property). */
    default View colorMultiply(Color color) {
        return Modified.props(this, Modified.prop(Properties.COLOR_MULTIPLY, color));
    }

    /** Invert the view's colors. */
    default View colorInvert() {
        return Modified.props(this, Modified.prop(Properties.COLOR_INVERT, 1));
    }

    /** Clip the view to its bounds. */
    default View clipped() {
        return Modified.props(this, Modified.prop(Properties.CLIPS_TO_BOUNDS, 1));
    }

    /** Clip the view to a shape ({@code CLIPS_TO_BOUNDS} + {@code SHAPE_KIND}). */
    default View clipShape(ShapeKind kind) {
        return Modified.props(
                this,
                Modified.prop(Properties.CLIPS_TO_BOUNDS, 1),
                Modified.prop(Properties.SHAPE_KIND, (float) kind.wire()));
    }

    /** Rotate the view after layout, in degrees (counter-clockwise). */
    default View rotation(float degrees) {
        return Modified.props(this, Modified.prop(Properties.ROTATION_DEGREES, degrees));
    }

    /** Uniformly scale the view after layout. */
    default View scaleEffect(float value) {
        return Modified.props(this, Modified.prop(Properties.SCALE, value));
    }

    /** Hide the view ({@code VISIBLE}=0). */
    default View hidden() {
        return Modified.props(this, Modified.prop(Properties.VISIBLE, 0));
    }

    /** Disable/enable the view ({@code ENABLED}: 1 = interactive). */
    default View disabled(boolean disabled) {
        return Modified.props(this, Modified.prop(Properties.ENABLED, disabled ? 0 : 1));
    }

    /** Whether the view participates in hit testing. */
    default View allowsHitTesting(boolean on) {
        return Modified.props(this, Modified.prop(Properties.ALLOWS_HIT_TESTING, on ? 1 : 0));
    }

    /** Control size (small / regular / large). */
    default View controlSize(ControlSize size) {
        return Modified.props(this, Modified.prop(Properties.CONTROL_SIZE, (float) size.wire()));
    }

    /** The accessibility label (a {@code STRING} property). */
    default View accessibilityLabel(String label) {
        return Modified.props(this, Modified.prop(Properties.LABEL, label));
    }

    /** The accessibility role (semantic enum code). */
    default View accessibilityRole(int role) {
        return Modified.props(this, Modified.prop(Properties.ROLE, (float) role));
    }

    /** The accessibility state (semantic enum code). */
    default View accessibilityState(int state) {
        return Modified.props(this, Modified.prop(Properties.STATE, (float) state));
    }

    /** Set the image source (a {@code STRING} property). */
    default View imageSource(String source) {
        return Modified.props(this, Modified.prop(Properties.IMAGE_SOURCE, source));
    }

    /** Declare which raw events this node wants reported (the {@code EVENT_LISTENERS} bitmask). */
    default View pointerEvents(int mask) {
        return Modified.props(this, Modified.prop(Properties.EVENT_LISTENERS, mask));
    }

    /** Set the action callback id (gates tap/action event delivery on the wire). */
    default View actionId(int id) {
        return Modified.props(this, Modified.prop(Properties.ACTION_ID, id));
    }

    /** Set the two-way binding id (gates value/text event delivery on the wire). */
    default View bindingId(int id) {
        return Modified.props(this, Modified.prop(Properties.BINDING_ID, id));
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

    /** An {@code Image} leaf with a source (resource name, file path, or absolute URL). */
    static Image image(String source) {
        return new Image(source);
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
    static TextField textField(String placeholder, WritableSignal<String> binding) {
        return new TextField(placeholder, binding);
    }

    /** A multi-line text editor bound to a writable signal. */
    static TextEditor textEditor(WritableSignal<String> binding) {
        return new TextEditor(binding);
    }

    /** A boolean control (switch/checkbox/toggle button) with a label. */
    static Toggle toggle(ToggleStyle style, boolean selected, WritableSignal<Boolean> binding, String label) {
        return new Toggle(style, selected, binding, label);
    }

    /** A {@code Switch}-style boolean control. */
    static Toggle toggle(boolean selected, WritableSignal<Boolean> binding) {
        return new Toggle(selected, binding);
    }

    /** A numeric range control. */
    static Slider slider(float value, float min, float max, WritableSignal<Float> binding) {
        return new Slider(value, min, max, binding);
    }

    /** A discrete increment/decrement control. */
    static Stepper stepper(float value, float min, float max, float step, WritableSignal<Float> binding) {
        return new Stepper(value, min, max, step, binding);
    }

    /** A determinate progress bar ({@code value} in {@code 0..1}). */
    static ProgressView progressView(float value) {
        return ProgressView.progress(value);
    }

    /** An indeterminate activity indicator. */
    static ProgressView progressView() {
        return ProgressView.indeterminate();
    }

    /** A read-only range meter. */
    static Gauge gauge(float value, float min, float max) {
        return new Gauge(value, min, max);
    }

    /** An axis-aligned separator line. */
    static Divider divider() {
        return new Divider();
    }

    /** A static 2D matrix grid. */
    static Grid grid(View... children) {
        return new Grid(children);
    }

    /** A scrollable content container. */
    static ScrollView scrollView(View... children) {
        return new ScrollView(children);
    }

    /** A virtualized vertical stack. */
    static LazyVStack lazyVStack(View... children) {
        return new LazyVStack(children);
    }

    /** A virtualized horizontal stack. */
    static LazyHStack lazyHStack(View... children) {
        return new LazyHStack(children);
    }

    /** A virtualized vertical grid. */
    static LazyVGrid lazyVGrid(View... children) {
        return new LazyVGrid(children);
    }

    /** A virtualized horizontal grid. */
    static LazyHGrid lazyHGrid(View... children) {
        return new LazyHGrid(children);
    }

    /** A selection control; the children are the options, {@code SELECTION} is the chosen index. */
    static Picker picker(PickerStyle style, WritableSignal<Integer> selection, View... options) {
        return new Picker(style, selection, options);
    }

    /** A menu with a custom trigger and action items. */
    static Menu menu(View trigger, View... actions) {
        return new Menu(trigger, actions);
    }

    /** A menu that reports the chosen action item index via {@code VALUE_CHANGED}. */
    static Menu menu(View trigger, WritableSignal<Integer> selection, View... actions) {
        return new Menu(trigger, selection, actions);
    }

    /** A native color picker bound to a color signal. */
    static ColorPicker colorPicker(WritableSignal<Color> binding) {
        return new ColorPicker(binding);
    }

    /** A date picker bound to days-since-epoch. */
    static DatePicker datePicker(DatePickerMode mode, WritableSignal<Integer> days) {
        return new DatePicker(mode, days);
    }

    /** Compose a list of child views into one {@link View}. */
    static View group(List<View> children) {
        return vstack(children.toArray(new View[0]));
    }
}