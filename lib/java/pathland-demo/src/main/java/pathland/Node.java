package pathland;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * A node in the retained view tree (mirrors {@code pathland_view::Node}).
 *
 * @param id         stable node id (assigned by {@code Bridge} / {@code assignIds})
 * @param component  raw protocol component id (hstack/vstack/text/button/spacer)
 * @param children   ordered child node ids
 * @param properties propertyId -> f32 value bits (floats for spacing/padding/size;
 *                   colors stored as raw AARRGGBB bits)
 */
public final class Node {
    public int id;
    public int component;
    /** Text content or button label ("" if none). */
    public String string = "";
    public final List<Node> children = new ArrayList<>();
    public final Map<Integer, Float> properties = new LinkedHashMap<>();

    public Node(int id, int component) {
        this.id = id;
        this.component = component;
    }
}
