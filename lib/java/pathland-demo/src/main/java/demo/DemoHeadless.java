package demo;

import com.sun.jna.Pointer;
import pathland.Align;
import pathland.Bridge;
import pathland.Constants;
import pathland.DSL;
import pathland.Justify;
import pathland.Node;
import pathland.PathlandNative;
import pathland.RingReader;
import pathland.View;

/**
 * Headless verification: DSL -> bridge -> Rust flat surface -> emit -> zero-copy
 * ring read -> assert the decoded text matches. No GUI, deterministic.
 *
 * Exercises the catalog-driven DSL: constructor properties (alignment,
 * justification, spacing) + global modifiers (padding, color) + the compound
 * frame modifier.
 */
public final class DemoHeadless {

    private DemoHeadless() {}

    public static void main(String[] args) {
        Pointer host = PathlandNative.INSTANCE.pathland_native_create();
        Bridge bridge = new Bridge(host);

        View root = DSL.vstack(
                Align.LEADING, Justify.START, 12f,
                DSL.hstack(
                        DSL.text("Count: 7").frame(Constants.FILL, Float.NaN, Align.LEADING),
                        DSL.button("Increment")
                ).padding(16f),
                DSL.text("Pathland · Java · shared ring").color(0x888888)
        ).padding(24f);

        Node tree = root.build();
        bridge.importTreeAndEmit(tree);

        Pointer mem = PathlandNative.INSTANCE.pathland_native_ring_ptr(host);
        String found = null;
        for (RingReader.TextEntry e : RingReader.readTextEntries(mem)) {
            if (e.text.startsWith("Count:")) {
                found = e.text;
            }
        }

        if (found == null) {
            System.err.println("FAIL: no Count text found in ring");
            System.exit(1);
        }
        if (!found.equals("Count: 7")) {
            System.err.println("FAIL: expected 'Count: 7' but got '" + found + "'");
            System.exit(1);
        }

        // Increment path: update one node's text and re-emit; re-read.
        bridge.updateTextAndEmit(3, "Count: 8");
        Pointer mem2 = PathlandNative.INSTANCE.pathland_native_ring_ptr(host);
        String found2 = null;
        for (RingReader.TextEntry e : RingReader.readTextEntries(mem2)) {
            if (e.text.startsWith("Count:")) {
                found2 = e.text;
            }
        }
        if (!"Count: 8".equals(found2)) {
            System.err.println("FAIL: expected 'Count: 8' after update but got '" + found2 + "'");
            System.exit(1);
        }

        PathlandNative.INSTANCE.pathland_native_destroy(host);
        System.out.println("OK: Java DSL -> Rust engine -> shared ring -> zero-copy read = 'Count: 8'");
    }
}
