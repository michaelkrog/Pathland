package demo;

import com.sun.jna.Pointer;
import pathland.Align;
import pathland.Bridge;
import pathland.DSL;
import pathland.Justify;
import pathland.Node;
import pathland.PathlandNative;
import pathland.RingReader;
import pathland.View;

import javax.swing.*;
import java.awt.*;

/**
 * Pathland Java + Swing desktop demo.
 *
 * Proves the cross-language + zero-copy story for Java:
 *  - a SwiftUI-like DSL authoring surface (pathland.DSL)
 *  - drives Rust components via the flat pathland_native C ABI (no per-component wrappers)
 *  - reads the resulting opcodes zero-copy from the shared-memory ring
 *
 * Run:
 *   PATH="$HOME/.cargo/bin:$PATH" cargo build -p pathland-native
 *   mvn -q -Dpathland.rust.target=<lib/rust/target/debug> compile exec:java
 */
public final class DemoApp {

    // Count text node id: pre-order ids of vstack(hstack(text, button), text) are
    // 1=vstack, 2=hstack, 3=count text, 4=button, 5=status text.
    private static final int COUNT_TEXT_ID = 3;

    private final JLabel countLabel;
    private int count = 0;
    private final Pointer host;
    private final Bridge bridge;

    public DemoApp() {
        host = PathlandNative.INSTANCE.pathland_native_create();
        bridge = new Bridge(host);

        countLabel = new JLabel("Count: 0");
        countLabel.setFont(countLabel.getFont().deriveFont(Font.BOLD, 24f));

        JButton increment = new JButton("Increment");
        increment.addActionListener(e -> clicked());

        JLabel status = new JLabel("Pathland · Java · shared ring");
        status.setForeground(new Color(0x88, 0x88, 0x88));

        JPanel panel = new JPanel();
        panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
        panel.setBorder(BorderFactory.createEmptyBorder(24, 24, 24, 24));
        panel.add(centered(countLabel));
        panel.add(Box.createVerticalStrut(12));
        panel.add(centered(increment));
        panel.add(Box.createVerticalStrut(12));
        panel.add(centered(status));

        JFrame frame = new JFrame("Pathland Java Demo");
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.setContentPane(panel);
        frame.pack();
        frame.setLocationRelativeTo(null);
        frame.setVisible(true);

        render();
    }

    private static JComponent centered(JComponent c) {
        JPanel p = new JPanel();
        p.add(c);
        return p;
    }

    private void clicked() {
        count += 1;
        bridge.updateTextAndEmit(COUNT_TEXT_ID, "Count: " + count);
        render();
    }

    /** Rebuild the tree through the DSL, bridge it, then read opcodes zero-copy. */
    private void render() {
        View root = DSL.vstack(
                Align.LEADING, Justify.START, 12f,
                DSL.hstack(DSL.text("Count: " + count), DSL.button("Increment")).padding(16f),
                DSL.text("Pathland · Java · shared ring").color(0x888888)
        ).padding(24f);

        Node tree = root.build();
        bridge.importTreeAndEmit(tree);

        // Zero-copy read: the Rust host returns the shared ring pointer; parse
        // opcodes in place.
        Pointer mem = PathlandNative.INSTANCE.pathland_native_ring_ptr(host);
        for (RingReader.TextEntry e : RingReader.readTextEntries(mem)) {
            if (e.id == COUNT_TEXT_ID) {
                countLabel.setText(e.text);
            }
        }
    }

    private void shutdown() {
        PathlandNative.INSTANCE.pathland_native_destroy(host);
    }

    public static void main(String[] args) {
        final DemoApp app = new DemoApp();
        Runtime.getRuntime().addShutdownHook(new Thread(app::shutdown));
    }
}
