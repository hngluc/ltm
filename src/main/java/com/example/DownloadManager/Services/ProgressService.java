// src/main/java/com/example/DownloadManager/ProgressService.java
package com.example.DownloadManager.Services;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class ProgressService {
    private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();

    // THÊM MỚI: Danh sách chung, dùng để thông báo cho TẤT CẢ client khi file list thay đổi
    private final List<SseEmitter> fileListEmitters = new CopyOnWriteArrayList<>();

    public SseEmitter createOrGet(String sessionId) {
        SseEmitter emitter = new SseEmitter(0L); // không timeout
        emitters.put(sessionId, emitter);
        emitter.onCompletion(() -> emitters.remove(sessionId));
        emitter.onTimeout(() -> emitters.remove(sessionId));
        emitter.onError(ex -> emitters.remove(sessionId));
        return emitter;
    }

    public SseEmitter createFileListEmitter() {
        // Timeout 30 phút
        SseEmitter emitter = new SseEmitter(30 * 60 * 1000L);

        // Thêm vào danh sách chung
        this.fileListEmitters.add(emitter);
        System.out.println("New client subscribed for file list updates. Total: " + fileListEmitters.size());

        // Xử lý khi client ngắt kết nối
        emitter.onCompletion(() -> {
            this.fileListEmitters.remove(emitter);
            System.out.println("Client disconnected from file list updates. Total: " + fileListEmitters.size());
        });
        emitter.onTimeout(() -> {
            emitter.complete();
            this.fileListEmitters.remove(emitter);
            System.out.println("Client timed out from file list updates. Total: " + fileListEmitters.size());
        });
        emitter.onError((e) -> {
            emitter.complete();
            this.fileListEmitters.remove(emitter);
            System.out.println("Client error from file list updates. Total: " + fileListEmitters.size());
        });

        // Gửi 1 tin nhắn "connected" ngay khi kết nối
        try {
            emitter.send(SseEmitter.event().name("connected").data("File list event stream connected"));
        } catch (IOException e) {
            emitter.complete();
            this.fileListEmitters.remove(emitter);
        }
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

    public void broadcastListChange(String eventType, Map<String, Object> data) {
        System.out.println("Broadcasting 'list-changed' event (" + eventType + ") to all clients...");

        // Gửi sự kiện tên "list-changed"
        SseEmitter.SseEventBuilder event = SseEmitter.event()
                .name("list-changed")
                .data(Map.of("type", eventType, "payload", data));

        // Lặp qua tất cả client và gửi
        for (SseEmitter emitter : this.fileListEmitters) {
            try {
                emitter.send(event);
            } catch (Exception e) {
                // Lỗi -> có thể client đã ngắt kết nối, xóa đi
                this.fileListEmitters.remove(emitter);
            }
        }
    }
}
