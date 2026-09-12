package com.pathland.quarkus;

import com.pathland.server.PathlandApp;
import com.pathland.server.PathlandRegistry;
import com.pathland.server.StateStores;
import com.pathland.view.state.InMemoryStateStore;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Disposes;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;

/**
 * CDI wiring for Pathland: builds the {@link PathlandRegistry} from the app's
 * {@link PathlandApp} bean and the default state store (Redis when reachable, else
 * in-memory), and shuts it down with the application. The app provides the root view:
 *
 * <pre>{@code
 * @ApplicationScoped
 * public class MyApp implements PathlandApp {
 *     public View newRoot() { return new MyHomeView(); }
 * }
 * }</pre>
 */
@ApplicationScoped
public class PathlandRegistryProducer {

    @Inject
    PathlandApp app;

    @Produces
    @Singleton
    PathlandRegistry registry() {
        return new PathlandRegistry(app, StateStores.redisOrFallback(new InMemoryStateStore()));
    }

    void shutdown(@Disposes PathlandRegistry registry) {
        registry.shutdown();
    }
}