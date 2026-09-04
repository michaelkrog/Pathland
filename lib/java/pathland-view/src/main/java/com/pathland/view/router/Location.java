package com.pathland.view.router;

/**
 * The platform navigation location the router hydrates from at mount (spec DSL.md
 * §4.5). The application owns navigation state on every platform; the location only
 * supplies the <em>initial</em> route — a request URL on SSR, a configured route or
 * platform deep-link on native.
 *
 * <p>On the web the browser is a mirror of the app's state: the DOM client reacts to
 * the emitted {@code ROUTE} property with {@code history.pushState}, and a back/forward
 * {@code popstate} arrives back as a {@code NAVIGATE} event (see
 * {@link Router#handlePlatformNavigation(String)}).
 */
public interface Location {

    /** The initial route at mount. */
    Route initial();
}