package com.pathland.demo;

import jakarta.inject.Inject;
import jakarta.ws.rs.CookieParam;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.NewCookie;
import jakarta.ws.rs.core.Response;

import java.util.UUID;

/**
 * Server-side rendering entry point. Sets a per-session cookie and renders that session's
 * persisted state (no flash: the first paint already shows the user's counter). The
 * browser sends the same cookie on the WebSocket handshake, so the socket joins the
 * identical session (1:1).
 */
@Path("/")
public class IndexResource {

    @Inject
    PathlandApp app;

    @GET
    @Produces(MediaType.TEXT_HTML)
    public Response index(@CookieParam("session") String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            sessionId = UUID.randomUUID().toString();
        }
        String html = app.renderHtml(sessionId);
        NewCookie cookie = new NewCookie.Builder("session")
                .value(sessionId)
                .path("/")
                .build();
        return Response.ok(html).cookie(cookie).build();
    }
}