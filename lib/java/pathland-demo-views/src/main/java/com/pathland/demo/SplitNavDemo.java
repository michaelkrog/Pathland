package com.pathland.demo;

import com.pathland.view.Alignment;
import com.pathland.view.Background;
import com.pathland.view.Border;
import com.pathland.view.Button;
import com.pathland.view.Color;
import com.pathland.view.Environment;
import com.pathland.view.FontSize;
import com.pathland.view.FontWeight;
import com.pathland.view.FontWeightMod;
import com.pathland.view.ForegroundStyle;
import com.pathland.view.FrameMod;
import com.pathland.view.HStack;
import com.pathland.view.Padding;
import com.pathland.view.Platform;
import com.pathland.view.Spacer;
import com.pathland.view.Text;
import com.pathland.view.VStack;
import com.pathland.view.View;
import com.pathland.view.router.Navigation;
import com.pathland.view.router.Router;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.Signals;
import com.pathland.view.signal.WritableSignal;

/**
 * A master-detail (split) navigation demo (spec PRIMITIVES.md: `NavigationSplitView` →
 * `HStack` sidebar + detail): a fixed **menu column on the left** with three items and
 * a `NavigationContainer` **content area on the right** that swaps on selection. The
 * menu is the developer's own navigation UI; the content area is the navigation slot
 * (`Navigation.of(router)`), so the renderer provides the detail chrome.
 *
 * <p>Routes: {@code /} and {@code /home} (Home), {@code /kitchen} (the full
 * {@link KitchenSinkView} showcase), {@code /settings} (a couple of bound controls), plus
 * a 404 fallback. Built with the {@link Navigation} facade — {@code Navigation.navigator}
 * collapses the route table + router + seeding. The active menu row is highlighted
 * reactively via {@code Navigation.isActive(router, path)} → a computed signal that
 * drives {@code Background.of(Signal<Color>)} / {@code ForegroundStyle.of(Signal<Color>)}.
 *
 * <p>The host mounts this view directly with the active platform path provided as an
 * environment value ({@code Platform.ACTIVE_PATH}); {@link #body()} reads it and builds
 * a **bound** router (external path changes are guard-processed, navigation is mirrored
 * back into the signal). The view itself is router-free — no wrapping, no app factory.
 * Content areas are router-free, self-contained views ({@link HomeView},
 * {@link SettingsView}, {@link KitchenSinkView}) instantiated inline in the route table.
 */
public final class SplitNavDemo implements View {

    private static final Color SIDEBAR_BG = Color.rgb(0xF2, 0xF3, 0xF7);
    private static final Color SIDEBAR_BORDER = Color.rgb(0xDD, 0xE0, 0xE8);
    private static final Color ACTIVE_BG = Color.rgb(0xDC, 0xE4, 0xFF);
    private static final Color ACTIVE_FG = Color.rgb(0x1A, 0x3A, 0x8C);

    @Override
    public View body() {
        // The active platform path is a scoped environment value (provided by the host).
        // Build a router bound to it: external writes (deep links/popstate) are
        // guard-processed, and navigation is mirrored back into the signal.
        WritableSignal<String> activePath = Environment.value(Platform.ACTIVE_PATH);
        Router router = Navigation.navigator()
                .route("/", new HomeView())
                .route("/home", new HomeView())
                .route("/kitchen", new KitchenSinkView())
                .route("/settings", new SettingsView())
                .fallback(Text.of("Not Found"))
                .build(activePath);
        // The split: a fixed sidebar column + the structural navigation slot (detail).
        // onPathChange demonstrates observing the active platform path without a router.
        return HStack.of(sidebar(router), Navigation.of(router))
                .onPathChange(path -> System.out.println("[split] active path: " + path));
    }

    // --- sidebar (the developer's own navigation UI) ---

    private static View sidebar(Router router) {
        return VStack.of(Alignment.LEADING, 8,
                Text.of("Pathland").modifiers(
                        FontSize.of(18), FontWeightMod.of(FontWeight.BOLD)),
                menuRow(router, "/home", "Home"),
                menuRow(router, "/kitchen", "Kitchen sink"),
                menuRow(router, "/settings", "Settings"),
                Spacer.of()
        ).modifiers(Padding.of(16))
                // Fixed-width sidebar with no height hint: as a flex child of the split
                // HStack it stretches to the row's full height (align-items: stretch).
                .modifier(FrameMod.of(200f, Alignment.LEADING))
                .modifier(Background.of(SIDEBAR_BG))
                .modifier(Border.of(SIDEBAR_BORDER, 1f));
    }

    /** A sidebar menu row: navigates the router (direct selection — no back-stack growth).
     *  The sidebar sits outside the {@code NavigationContainer} (it is the developer's own
     *  nav chrome), so it captures the router explicitly — the nearest-enclosing-router
     *  mechanism (spec DSL.md §4.5) resolves intents for components *inside* a container. */
    private static View menuRow(Router router, String path, String label) {
        // Reactive active-item highlight via Navigation.isActive: a computed signal from
        // the route signal, so a selection re-emits only this row's background/color.
        Signal<Boolean> active = Navigation.isActive(router, path);
        Signal<Color> bg = Signals.computed(() -> active.get() ? ACTIVE_BG : Color.CLEAR);
        Signal<Color> fg = Signals.computed(() -> active.get() ? ACTIVE_FG : Color.BLACK);
        return Button.of(Text.of(label).modifier(Padding.of(14)), () -> router.navigate(path))
                .modifier(Background.of(bg))
                .modifier(ForegroundStyle.of(fg));
    }
}