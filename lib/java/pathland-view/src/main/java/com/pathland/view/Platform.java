package com.pathland.view;

import com.pathland.view.signal.WritableSignal;

/**
 * Platform-level environment values and helpers (spec DSL.md §4.5). Unlike
 * {@code Navigation.ROUTER} (the router *instance*, only present when navigation is
 * declared), the active platform path is provided by the host for **every** app —
 * with or without navigation — so any app can observe the current path (a web URL, a
 * native deep link / open event, the initial route) like SwiftUI's {@code onOpenURL},
 * generalized across platforms.
 *
 * <pre>{@code
 * // host (always):
 * WritableSignal<String> activePath = Signals.signal(env.route());
 * emitter.mount(root.environment(Platform.ACTIVE_PATH, activePath), env);
 *
 * // app — with or without navigation:
 * view.onPathChange(path -> handlePlatformPath(path));
 * }</pre>
 */
public final class Platform {

    /** The environment key for the app's active platform path (a writable signal). */
    public static final EnvironmentKey<WritableSignal<String>> ACTIVE_PATH = EnvironmentKey.of("platform.activePath");

    private Platform() {}
}