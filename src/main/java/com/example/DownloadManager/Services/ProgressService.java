// src/main/java/com/example/DownloadManager/ProgressService.java
package com.example.DownloadManager.Services;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ProgressService {
    private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();

    public SseEmitter createOrGet(String sessionId) {
        SseEmitter emitter = new SseEmitter(0L); // không timeout
        emitters.put(sessionId, emitter);
        emitter.onCompletion(() -> emitters.remove(sessionId));
        emitter.onTimeout(() -> emitters.remove(sessionId));
        emitter.onError(ex -> emitters.remove(sessionId));
        return emitter;
    }

    public void sendProgress(String sessionId, int percent, long sent, long total) {
        SseEmitter emitter = emitters.get(sessionId);
        if (emitter == null) return;
        try {
            String payload = String.format("{\"percent\":%d,\"sent\":%d,\"total\":%d}", percent, sent, total);
            emitter.send(SseEmitter.event().name("progress").data(payload));
        } catch (IOException e) {
            emitters.remove(sessionId);
            emitter.completeWithError(e);
        }
    }

    public void complete(String sessionId) {
        SseEmitter emitter = emitters.remove(sessionId);
        if (emitter != null) {
            try { emitter.send(SseEmitter.event().name("done").data("{}")); } catch (IOException ignored) {}
            emitter.complete();
        }
    }
}
