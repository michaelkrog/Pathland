package com.pathland.quarkus;

import jakarta.inject.Inject;
import jakarta.ws.rs.CookieParam;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.NewCookie;
import jakarta.ws.rs.core.Response;

import java.util.UUID;

/**
 * Server-side rendering entry point. Sets a per-session cookie and renders that session's
 * persisted state. The browser sends the same cookie on the WebSocket handshake, so the
 * socket joins the identical session (1:1).
 *
 * <p>The initial route is part of the platform environment (spec/OPCODE.md §Environment
 * fields): the request path is synthesized into the environment's {@code ROUTE} field, so
 * a deep link like {@code /users/42} renders its destination on the first paint. The
 * WebSocket later enriches the environment (viewport, …).
 */
@Path("/")
public class IndexResource {

    @Inject
    PathlandApp app;

    /** The root page (the route is {@code /}). */
    @GET
    @Produces(MediaType.TEXT_HTML)
    public Response index(@CookieParam("session") String sessionId) {
        return render("/", sessionId);
    }

    /**
     * Any other path (deep links) — a multi-segment catch-all. The negative lookahead
     * excludes the literal {@code ws} path so the {@code @WebSocket("/ws")} endpoint
     * (not this HTML renderer) handles the WebSocket upgrade. Quarkus serves the static
     * JS bundle from {@code META-INF/resources} before JAX-RS, so it is not shadowed.
     */
    @GET
    @Path("{path:(?!ws).*}")
    @Produces(MediaType.TEXT_HTML)
    public Response deep(@PathParam("path") String path, @CookieParam("session") String sessionId) {
        return render("/" + path, sessionId);
    }

    private Response render(String route, String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            sessionId = UUID.randomUUID().toString();
        }
        String html = app.renderHtml(sessionId, route);
        NewCookie cookie = new NewCookie.Builder("session")
                .value(sessionId)
                .path("/")
                .build();
        return Response.ok(html).cookie(cookie).build();
    }
}