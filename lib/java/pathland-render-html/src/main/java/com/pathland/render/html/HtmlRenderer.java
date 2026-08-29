package com.pathland.render.html;

import com.pathland.view.Categories;
import com.pathland.view.Commands;
import com.pathland.view.Components;
import com.pathland.view.Properties;
import com.pathland.view.ShapeKind;
import com.pathland.view.ToggleStyle;
import com.pathland.view.ValueTypes;
import com.pathland.view.emit.Frame;
import com.pathland.view.emit.Opcode;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * A Pathland renderer that maps opcode frames onto declarative HTML elements — the
 * Java port of {@code pathland-render-html}. Like every Pathland renderer it is a pure
 * function of the opcode stream: it retains only its own decoded output tree (a cache),
 * never application state, and emits WHAT the UI is, never layout rects.
 *
 * <p>This is the server-side render (SSR) / remote-projection target. Frames are
 * self-contained ({@code SET_TEXT} resolves by a relative offset into the frame's own
 * string section), and every rendered element carries a stable {@code data-pathland-id}
 * so a client can hydrate it and apply later deltas in place.
 */
public final class HtmlRenderer {

    /** A decoded node in the retained description (the renderer's own cache). */
    static final class Node {
        final int component;
        String text;
        int days;
        int millisOfDay;
        final Map<Integer, Integer> properties = new TreeMap<>();
        final Map<Integer, String> strings = new TreeMap<>();
        final List<Integer> children = new ArrayList<>();

        Node(int component) {
            this.component = component;
        }

        Float spacing() {
            Integer bits = properties.get(Properties.SPACING);
            return bits == null ? null : Float.intBitsToFloat(bits);
        }

        boolean checked() {
            Integer bits = properties.get(Properties.SELECTED);
            return bits != null && bits != 0;
        }

        float f32Property(int property, float defaultValue) {
            Integer bits = properties.get(property);
            return bits == null ? defaultValue : Float.intBitsToFloat(bits);
        }
    }

    private final Map<Integer, Node> nodes = new TreeMap<>();

    public HtmlRenderer() {}

    /** Apply a self-contained frame (opcodes + string section), mutating the retained tree. */
    public void applyFrame(Frame frame) {
        for (Opcode op : frame.opcodes()) {
            switch (op.category()) {
                case Categories.TREE -> applyTree(op.command(), op);
                case Categories.STYLE -> applyStyle(op.command(), op, frame);
                default -> { }
            }
        }
    }

    private void applyTree(int command, Opcode op) {
        switch (command) {
            case Commands.Tree.CREATE_NODE -> nodes.put(op.a(), new Node(op.b()));
            case Commands.Tree.DELETE_NODE -> nodes.remove(op.a());
            case Commands.Tree.INSERT_CHILD -> {
                Node parent = nodes.get(op.a());
                if (parent != null) {
                    parent.children.add(op.b());
                }
            }
            case Commands.Tree.REMOVE_CHILD -> {
                Node parent = nodes.get(op.a());
                if (parent != null) {
                    parent.children.remove(Integer.valueOf(op.b()));
                }
            }
            case Commands.Tree.MOVE_CHILD -> {
                Node parent = nodes.get(op.a());
                if (parent != null) {
                    Integer child = op.b();
                    parent.children.remove(child);
                    int index = Math.min(op.c(), parent.children.size());
                    parent.children.add(index, child);
                }
            }
            default -> { }
        }
    }

    private void applyStyle(int command, Opcode op, Frame frame) {
        switch (command) {
            case Commands.Style.SET_TEXT -> {
                Node node = nodes.get(op.a());
                if (node != null) {
                    node.text = frame.stringAt(op.b());
                }
            }
            case Commands.Style.SET_DATE -> {
                Node node = nodes.get(op.a());
                if (node != null) {
                    node.days = op.b();
                    node.millisOfDay = op.c();
                }
            }
            case Commands.Style.SET_PROPERTY -> {
                Node node = nodes.get(op.a());
                if (node == null) {
                    return;
                }
                int property = op.b() & 0xFFFF;
                int valueType = (op.b() >>> 16) & 0xFF;
                if (valueType == ValueTypes.STRING) {
                    node.strings.put(property, frame.stringAt(op.c()));
                } else {
                    node.properties.put(property, op.c());
                }
            }
            default -> { }
        }
    }

    /** Render the subtree rooted at {@code root} as a full HTML document. */
    public String render(int root) {
        String body = renderNode(root);
        return "<!DOCTYPE html>\n<html>\n<head>\n<meta charset=\"utf-8\">\n"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
                + "<title>Pathland</title>\n"
                + "<style>\n"
                + "body { font-family: system-ui, sans-serif; margin: 0; padding: 16px; }\n"
                + "button { padding: 8px 16px; font: inherit; }\n"
                + ".pathland-toggle { display: inline-flex; align-items: center; gap: 8px; }\n"
                + ".pathland-toggle input[type=\"checkbox\"] { accent-color: #2196F3; width: 16px; height: 16px; }\n"
                + ".pathland-toggle input[role=\"switch\"] { appearance: none; width: 44px; height: 24px; border-radius: 12px; background: #bbb; cursor: pointer; position: relative; transition: background 0.15s; }\n"
                + ".pathland-toggle input[role=\"switch\"]:checked { background: #2196F3; }\n"
                + ".pathland-toggle input[role=\"switch\"]::after { content: \"\"; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: white; transition: left 0.15s; }\n"
                + ".pathland-toggle input[role=\"switch\"]:checked::after { left: 22px; }\n"
                + ".pathland-slider { display: inline-flex; align-items: center; gap: 10px; }\n"
                + ".pathland-slider input[type=\"range\"] { flex: 1; accent-color: #2196F3; }\n"
                + ".pathland-spinner { width: 22px; height: 22px; border: 3px solid #ccc; border-top-color: #2196F3; border-radius: 50%; animation: pathland-spin 0.8s linear infinite; }\n"
                + "@keyframes pathland-spin { to { transform: rotate(360deg); } }\n"
                + ".pathland-gauge { width: 120px; height: 10px; background: #eee; border-radius: 5px; overflow: hidden; }\n"
                + ".pathland-gauge div { height: 100%; background: #2196F3; }\n"
                + ".pathland-stepper { display: inline-flex; align-items: center; gap: 8px; }\n"
                + ".pathland-stepper button { width: 28px; height: 28px; }\n"
                + ".pathland-menu { position: relative; display: inline-block; }\n"
                + ".pathland-menu-items { display: none; position: absolute; background: white; border: 1px solid #ccc; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }\n"
                + ".pathland-menu:hover .pathland-menu-items { display: block; }\n"
                + ".pathland-textfield { display: inline-flex; align-items: center; gap: 8px; }\n"
                + ".pathland-textfield input[type=\"text\"] { font: inherit; padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; }\n"
                + "</style>\n</head>\n<body>" + body + "</body>\n</html>\n";
    }

    /** Render the subtree rooted at {@code root} as an HTML fragment (no document). */
    public String renderFragment(int root) {
        return renderNode(root);
    }

    private String renderNode(int id) {
        Node node = nodes.get(id);
        if (node == null) {
            return "";
        }
        if (node.properties.getOrDefault(Properties.VISIBLE, 1) == 0) {
            return ""; // hidden (VISIBLE=0): removed from layout + hit testing
        }
        StringBuilder children = new StringBuilder();
        for (Integer child : node.children) {
            children.append(renderNode(child));
        }
        String dataId = " data-pathland-id=\"" + id + "\"";
        String border = borderStyle(node);
        String decor = decorStyle(node);

        return switch (node.component) {
            case Components.VSTACK -> wrapStack(id, "column", node, children.toString(), decor);
            case Components.HSTACK -> wrapStack(id, "row", node, children.toString(), decor);
            case Components.TEXT -> {
                String text = escape(node.text == null ? "" : node.text);
                yield "<span" + dataId + styleAttr(decor) + ">" + text + "</span>";
            }
            case Components.BUTTON -> {
                String text = escape(node.text == null ? "" : node.text);
                yield "<button" + dataId + styleAttr(decor) + ">" + text + "</button>";
            }
            case Components.COLOR -> {
                int color = node.properties.getOrDefault(Properties.COLOR, 0xFF000000);
                // Layout-greedy (SwiftUI Color): expands to the available space.
                yield "<div" + dataId + " style=\"flex:1 1 auto;align-self:stretch;background-color:"
                        + rgba(color) + ";" + border + "\"></div>";
            }
            case Components.SHAPE -> {
                int kind = Math.round(node.f32Property(Properties.SHAPE_KIND, ShapeKind.RECTANGLE.wire()));
                int fill = node.properties.getOrDefault(Properties.COLOR,
                        node.properties.getOrDefault(Properties.BACKGROUND_COLOR, 0xFF000000));
                String css = "background-color:" + rgba(fill) + ";";
                if (kind == ShapeKind.CIRCLE.wire()) {
                    css += "border-radius:50%;";
                } else if (kind == ShapeKind.ROUNDED_RECTANGLE.wire()) {
                    Integer radiusBits = node.properties.get(Properties.BORDER_RADIUS);
                    if (radiusBits != null) {
                        css += "border-radius:" + fmt(Float.intBitsToFloat(radiusBits)) + "px;";
                    }
                }
                yield "<div" + dataId + " style=\"" + css + border + "\"></div>";
            }
            case Components.TOGGLE -> {
                int style = Math.round(node.f32Property(Properties.TOGGLE_STYLE, ToggleStyle.SWITCH.wire()));
                String role = style == ToggleStyle.SWITCH.wire() ? " role=\"switch\"" : "";
                String checked = node.checked() ? " checked" : "";
                String text = escape(node.text == null ? "" : node.text);
                yield "<label" + dataId + " class=\"pathland-toggle\"" + styleAttr(decor)
                        + "><input type=\"checkbox\"" + role + checked
                        + "><span class=\"pathland-text\">" + text + "</span></label>";
            }
            case Components.DIVIDER -> {
                yield "<hr" + dataId + styleAttr(decor) + ">";
            }
            case Components.PROGRESS_VIEW -> {
                boolean indeterminate = node.properties.getOrDefault(Properties.IS_INDETERMINATE, 0) != 0;
                if (indeterminate) {
                    yield "<div" + dataId + " class=\"pathland-spinner\"" + styleAttr(decor) + "></div>";
                }
                float progress = node.f32Property(Properties.PROGRESS, 0f);
                yield "<progress" + dataId + " max=\"1\" value=\"" + fmt(progress) + "\""
                        + styleAttr(decor) + "></progress>";
            }
            case Components.GAUGE -> {
                float min = node.f32Property(Properties.MIN_VALUE, 0f);
                float max = node.f32Property(Properties.MAX_VALUE, 1f);
                float value = node.f32Property(Properties.VALUE, min);
                float span = max - min;
                float pct = span <= 0f ? 0f : (value - min) / span * 100f;
                yield "<div" + dataId + " class=\"pathland-gauge\"" + styleAttr(decor)
                        + "><div style=\"width:" + fmt(pct) + "%\"></div></div>";
            }
            case Components.TEXT_EDITOR -> {
                String value = escape(node.text == null ? "" : node.text);
                yield "<textarea" + dataId + styleAttr(decor) + ">" + value + "</textarea>";
            }
            case Components.STEPPER -> {
                float min = node.f32Property(Properties.MIN_VALUE, 0f);
                float max = node.f32Property(Properties.MAX_VALUE, 10f);
                float step = node.f32Property(Properties.STEP_VALUE, 1f);
                float value = node.f32Property(Properties.VALUE, min);
                yield "<div" + dataId + " class=\"pathland-stepper\"" + styleAttr(decor)
                        + "><button data-step=\"-1\">−</button><span>" + fmt(value)
                        + "</span><button data-step=\"1\">+</button>"
                        + "<span class=\"pathland-stepper-range\" data-min=\"" + fmt(min)
                        + "\" data-max=\"" + fmt(max) + "\" data-step=\"" + fmt(step)
                        + "\" style=\"display:none\"></span></div>";
            }
            case Components.GRID, Components.LAZY_VGRID, Components.LAZY_HGRID -> {
                yield wrapGrid(id, node, children.toString(), decor);
            }
            case Components.SCROLLVIEW -> {
                yield "<div" + dataId + " style=\"overflow:auto;" + decor + "\">" + children + "</div>";
            }
            case Components.LAZY_VSTACK -> wrapStack(id, "column", node, children.toString(), decor);
            case Components.LAZY_HSTACK -> wrapStack(id, "row", node, children.toString(), decor);
            case Components.PICKER -> {
                Integer selection = node.properties.get(Properties.SELECTION);
                StringBuilder options = new StringBuilder();
                int index = 0;
                for (Integer child : node.children) {
                    Node option = nodes.get(child);
                    if (option != null) {
                        String label = escape(option.text == null ? "" : option.text);
                        options.append("<option")
                                .append(selection != null && selection == index ? " selected" : "")
                                .append(">").append(label).append("</option>");
                    }
                    index++;
                }
                yield "<select" + dataId + styleAttr(decor) + ">" + options + "</select>";
            }
            case Components.MENU -> {
                StringBuilder actions = new StringBuilder();
                for (int i = 1; i < node.children.size(); i++) {
                    actions.append(renderNode(node.children.get(i)));
                }
                String trigger = node.children.isEmpty() ? "" : renderNode(node.children.get(0));
                yield "<div" + dataId + " class=\"pathland-menu\"" + styleAttr(decor)
                        + "><div class=\"pathland-menu-trigger\">" + trigger + "</div>"
                        + "<div class=\"pathland-menu-items\">" + actions + "</div></div>";
            }
            case Components.COLOR_PICKER -> {
                int argb = node.properties.getOrDefault(Properties.COLOR_VALUE, 0xFF000000);
                String hex = String.format("#%02x%02x%02x", (argb >> 16) & 0xFF, (argb >> 8) & 0xFF, argb & 0xFF);
                yield "<input" + dataId + " type=\"color\" value=\"" + hex + "\"" + styleAttr(decor) + ">";
            }
            case Components.DATE_PICKER -> {
                String value = "";
                if (node.days != 0) {
                    value = java.time.LocalDate.ofEpochDay(node.days).toString();
                }
                yield "<input" + dataId + " type=\"date\" value=\"" + value + "\"" + styleAttr(decor) + ">";
            }
            case Components.SPACER -> {
                String style = border.isEmpty()
                        ? "flex:1"
                        : "flex:1;" + border;
                yield "<div" + dataId + " style=\"" + style + "\"></div>";
            }
            case Components.SLIDER -> {
                float min = node.f32Property(Properties.MIN_VALUE, 0f);
                float max = node.f32Property(Properties.MAX_VALUE, 1f);
                float value = node.f32Property(Properties.VALUE, min);
                String text = escape(node.text == null ? "" : node.text);
                yield "<label" + dataId + " class=\"pathland-slider\"" + styleAttr(decor)
                        + "><input type=\"range\" min=\"" + fmt(min) + "\" max=\"" + fmt(max)
                        + "\" step=\"any\" value=\"" + fmt(value) + "\"><span class=\"pathland-text\">"
                        + text + "</span></label>";
            }
            case Components.TEXT_FIELD -> {
                String value = escape(node.text == null ? "" : node.text);
                String label = escape(node.strings.getOrDefault(Properties.LABEL, ""));
                String prompt = escape(node.strings.getOrDefault(Properties.PROMPT, ""));
                yield "<label" + dataId + " class=\"pathland-textfield\"" + styleAttr(decor)
                        + "><span class=\"pathland-label\">" + label
                        + "</span><input type=\"text\" value=\"" + value + "\" placeholder=\"" + prompt
                        + "\"></label>";
            }
            default -> children.toString();
        };
    }

    private String wrapStack(int id, String direction, Node node, String children, String border) {
        StringBuilder style = new StringBuilder("display:flex;flex-direction:").append(direction).append(';');
        Float spacing = node.spacing();
        if (spacing != null) {
            style.append("gap:").append(fmt(spacing)).append("px;");
        }
        style.append("align-items:center;").append(border);
        return "<div data-pathland-id=\"" + id + "\" style=\"" + style + "\">" + children + "</div>";
    }

    private String wrapGrid(int id, Node node, String children, String border) {
        StringBuilder style = new StringBuilder("display:grid;");
        Float spacing = node.spacing();
        if (spacing != null) {
            style.append("gap:").append(fmt(spacing)).append("px;");
        }
        style.append("align-items:center;").append(border);
        return "<div data-pathland-id=\"" + id + "\" style=\"" + style + "\">" + children + "</div>";
    }

    /** Border CSS decoded from BORDER_WIDTH/COLOR/RADIUS/EDGES (empty when no border). */
    private String borderStyle(Node node) {
        Integer widthBits = node.properties.get(Properties.BORDER_WIDTH);
        if (widthBits == null) {
            return "";
        }
        float width = Float.intBitsToFloat(widthBits);
        int color = node.properties.getOrDefault(Properties.BORDER_COLOR, 0xFF000000);
        int edges = node.properties.getOrDefault(Properties.BORDER_EDGES, 0x0F);
        StringBuilder css = new StringBuilder();
        for (Object[] side : List.of(
                new Object[]{0x01, "top"},
                new Object[]{0x02, "left"},
                new Object[]{0x04, "bottom"},
                new Object[]{0x08, "right"})) {
            if ((edges & (Integer) side[0]) != 0) {
                css.append("border-").append(side[1]).append(':').append(fmt(width))
                        .append("px solid ").append(rgba(color)).append(';');
            }
        }
        Integer radiusBits = node.properties.get(Properties.BORDER_RADIUS);
        if (radiusBits != null) {
            float radius = Float.intBitsToFloat(radiusBits);
            if (radius != 0f) {
                css.append("border-radius:").append(fmt(radius)).append("px;");
            }
        }
        return css.toString();
    }

    /** Decor CSS shared by every node: border + background + padding + opacity. */
    private String decorStyle(Node node) {
        StringBuilder css = new StringBuilder(borderStyle(node));
        Integer bg = node.properties.get(Properties.BACKGROUND_COLOR);
        if (bg != null) {
            css.append("background-color:").append(rgba(bg)).append(';');
        }
        Integer padBits = node.properties.get(Properties.PADDING);
        if (padBits != null) {
            css.append("padding:").append(fmt(Float.intBitsToFloat(padBits))).append("px;");
        }
        Integer opacityBits = node.properties.get(Properties.OPACITY);
        if (opacityBits != null) {
            float opacity = Float.intBitsToFloat(opacityBits);
            if (opacity < 1f) {
                css.append("opacity:").append(fmt(opacity)).append(';');
            }
        }
        return css.toString();
    }

    /** Format a float Rust-style ({@code 6.0 → "6"}, {@code 0.5 → "0.5"}). */
    private static String fmt(float v) {
        if (v == Math.floor(v) && !Float.isInfinite(v) && v >= Integer.MIN_VALUE && v <= Integer.MAX_VALUE) {
            return String.valueOf((int) v);
        }
        return String.valueOf(v);
    }

    /** Format {@code 0xAARRGGBB} as a CSS {@code rgba(...)} string (alpha in {@code 0..1}). */
    private static String rgba(int argb) {
        int r = (argb >> 16) & 0xFF;
        int g = (argb >> 8) & 0xFF;
        int b = argb & 0xFF;
        float a = ((argb >> 24) & 0xFF) / 255f;
        return "rgba(" + r + "," + g + "," + b + "," + a + ")";
    }

    private static String styleAttr(String css) {
        return css.isEmpty() ? "" : " style=\"" + css + "\"";
    }

    /** Escape text for inclusion in an HTML body. */
    static String escape(String input) {
        return input.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}