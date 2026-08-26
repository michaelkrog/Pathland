package com.pathland.render.html;

import com.pathland.view.Categories;
import com.pathland.view.Commands;
import com.pathland.view.Components;
import com.pathland.view.Properties;
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
        StringBuilder children = new StringBuilder();
        for (Integer child : node.children) {
            children.append(renderNode(child));
        }
        String dataId = " data-pathland-id=\"" + id + "\"";
        String border = borderStyle(node);

        return switch (node.component) {
            case Components.VSTACK -> wrapStack(id, "column", node, children.toString(), border);
            case Components.HSTACK -> wrapStack(id, "row", node, children.toString(), border);
            case Components.TEXT -> {
                String text = escape(node.text == null ? "" : node.text);
                yield "<span" + dataId + styleAttr(border) + ">" + text + "</span>";
            }
            case Components.BUTTON -> {
                String text = escape(node.text == null ? "" : node.text);
                yield "<button" + dataId + styleAttr(border) + ">" + text + "</button>";
            }
            case Components.SWITCH, Components.CHECKBOX -> {
                String role = node.component == Components.SWITCH ? " role=\"switch\"" : "";
                String checked = node.checked() ? " checked" : "";
                String text = escape(node.text == null ? "" : node.text);
                yield "<label" + dataId + " class=\"pathland-toggle\"" + styleAttr(border)
                        + "><input type=\"checkbox\"" + role + checked
                        + "><span class=\"pathland-text\">" + text + "</span></label>";
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
                yield "<label" + dataId + " class=\"pathland-slider\"" + styleAttr(border)
                        + "><input type=\"range\" min=\"" + fmt(min) + "\" max=\"" + fmt(max)
                        + "\" step=\"any\" value=\"" + fmt(value) + "\"><span class=\"pathland-text\">"
                        + text + "</span></label>";
            }
            case Components.TEXT_FIELD -> {
                String value = escape(node.text == null ? "" : node.text);
                String label = escape(node.strings.getOrDefault(Properties.LABEL, ""));
                String prompt = escape(node.strings.getOrDefault(Properties.PROMPT, ""));
                yield "<label" + dataId + " class=\"pathland-textfield\"" + styleAttr(border)
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