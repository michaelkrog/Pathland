package com.pathland.spring;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.UUID;

/**
 * Server-side rendering entry point. Sets a per-session cookie and renders that session's
 * persisted state. The browser sends the same cookie on the WebSocket handshake.
 */
@Controller
public class IndexController {

    @Autowired
    private PathlandService service;

    @GetMapping("/")
    @ResponseBody
    public ResponseEntity<String> index(@CookieValue(value = "session", required = false) String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            sessionId = UUID.randomUUID().toString();
        }
        String html = service.renderHtml(sessionId);
        ResponseCookie cookie = ResponseCookie.from("session", sessionId).path("/").build();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .contentType(MediaType.TEXT_HTML)
                .body(html);
    }
}