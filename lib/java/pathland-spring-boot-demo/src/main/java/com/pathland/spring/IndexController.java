package com.pathland.spring;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.servlet.http.HttpServletRequest;

import java.io.IOException;
import java.io.InputStream;
import java.util.UUID;

/**
 * Server-side rendering entry point. Sets a per-session cookie and renders that session's
 * persisted state. The browser sends the same cookie on the WebSocket handshake.
 *
 * <p>The initial route is part of the platform environment (spec/OPCODE.md §Environment
 * fields): the request path is synthesized into the environment's {@code ROUTE} field, so
 * a deep link like {@code /users/42} renders its destination on the first paint. The
 * WebSocket later enriches the environment (viewport, …).
 */
@Controller
public class IndexController {

    @Autowired
    private PathlandService service;

    /**
     * The SPA catch-all: every path renders the session shell seeded at the request path.
     * Requests carrying an {@code Upgrade} header (the `/ws` WebSocket handshake) are
     * excluded so they reach the registered WebSocket handler, not this HTML renderer.
     */
    @GetMapping(value = "/{*path}", headers = "!Upgrade")
    @ResponseBody
    public ResponseEntity<String> index(
            @CookieValue(value = "session", required = false) String sessionId,
            HttpServletRequest request) {
        if (sessionId == null || sessionId.isBlank()) {
            sessionId = UUID.randomUUID().toString();
        }
        String route = request.getRequestURI(); // e.g. "/users/42" or "/"
        String html = service.renderHtml(sessionId, route);
        ResponseCookie cookie = ResponseCookie.from("session", sessionId).path("/").build();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .contentType(MediaType.TEXT_HTML)
                .body(html);
    }

    /**
     * The single static asset — served explicitly so the {@code /{*path}} catch-all never
     * shadows it. Built by {@code lib/typescript} and copied into {@code src/main/resources/static}.
     */
    @GetMapping(value = "/pathland-dom-renderer.js", produces = "application/javascript")
    @ResponseBody
    public byte[] bundle() throws IOException {
        try (InputStream in = new ClassPathResource("static/pathland-dom-renderer.js").getInputStream()) {
            return in.readAllBytes();
        }
    }
}