// src/main/java/com/example/DownloadManager/FileController.java
package com.example.DownloadManager.Controller;

import com.example.DownloadManager.Services.ProgressService;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.*;

@RestController
@RequestMapping("/files")
@CrossOrigin(origins = "*") // chấp nhận FE localhost
public class FileController {

    private Path ROOT = Paths.get("shared").toAbsolutePath().normalize();

    @Autowired
    private ProgressService progressService;


    @PostConstruct
    public void init() throws IOException {
        System.out.println(">>> USING SHARED DIR: " + ROOT);
        if (!Files.exists(ROOT)) Files.createDirectories(ROOT);
    }

    // ===== Realtime Progress (SSE) =====
    @GetMapping(path="/progress/subscribe", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe(@RequestParam String sessionId) {
        return progressService.createOrGet(sessionId);
    }

    // ===== (Tùy chọn) Upload =====
    /** UPLOAD nhiều file (multipart/form-data) – không resume */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> upload(@RequestPart("files") MultipartFile[] files) {
        if (files == null || files.length == 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "No files"));
        }
        List<Map<String, Object>> results = new ArrayList<>();
        for (MultipartFile mf : files) {
            String rawName = Objects.requireNonNullElse(mf.getOriginalFilename(), "unnamed");
            // chặn path traversal
            String safeName = Paths.get(rawName).getFileName().toString();
            try {
                if (!Files.exists(ROOT)) Files.createDirectories(ROOT);
                Path dest = ROOT.resolve(safeName).normalize();
                // ghi đè nếu trùng tên
                Files.copy(mf.getInputStream(), dest, StandardCopyOption.REPLACE_EXISTING);
                results.add(Map.of(
                        "name", safeName,
                        "size", Files.size(dest),
                        "status", "OK"
                ));
            } catch (IOException e) {
                results.add(Map.of(
                        "name", safeName,
                        "status", "ERROR",
                        "error", e.getMessage()
                ));
            }
        }
        return ResponseEntity.ok(Map.of("files", results));
    }

    // ===== List =====
    @GetMapping
    public List<Map<String, Object>> listFiles() throws IOException {
        if (!Files.exists(ROOT)) Files.createDirectories(ROOT);
        try (Stream<Path> s = Files.list(ROOT)) {
            return s.filter(Files::isRegularFile)
                    .map(p -> {
                        try {
                            Map<String, Object> m = new HashMap<>();
                            m.put("name", p.getFileName().toString());
                            m.put("size", Files.size(p));
                            m.put("lastModified", Files.getLastModifiedTime(p).toMillis());
                            return m;
                        } catch (IOException e) { throw new UncheckedIOException(e); }
                    })
                    .collect(Collectors.toList());
        }
    }

    // ===== Download + Resume + Realtime =====
    @GetMapping("/{name}")
    public ResponseEntity<Resource> download(
            @PathVariable String name,
            @RequestHeader(value = "Range", required = false) String rangeHeader,
            @RequestParam(required = false) String sessionId
    ) {
        try {
            if (name.contains("..") || name.contains("/") || name.contains("\\")) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
            }
            Path file = ROOT.resolve(name).normalize();
            if (!Files.exists(file) || !Files.isRegularFile(file)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }

            long total = Files.size(file);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentDisposition(ContentDisposition.attachment().filename(name).build());
            headers.add("Accept-Ranges", "bytes");

            // Không Range -> full
            if (rangeHeader == null || !rangeHeader.startsWith("bytes=")) {
                InputStream is = Files.newInputStream(file);
                InputStream progressIs = new ProgressInputStream(is, total, sessionId, progressService, 0);
                return ResponseEntity.ok()
                        .headers(headers)
                        .contentLength(total)
                        .body(new InputStreamResource(progressIs));
            }

            // Có Range -> partial
            String[] parts = rangeHeader.replace("bytes=", "").trim().split("-");
            long start = Long.parseLong(parts[0]);
            long end = (parts.length > 1 && !parts[1].isEmpty()) ? Long.parseLong(parts[1]) : total - 1;

            if (start >= total) {
                return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                        .header("Content-Range", "bytes */" + total)
                        .build();
            }
            end = Math.min(end, total - 1);
            long len = end - start + 1;

            InputStream is = Files.newInputStream(file);
            is.skip(start);
            InputStream limited = new LimitedInputStream(is, len);
            InputStream progressIs = new ProgressInputStream(limited, total, sessionId, progressService, start);

            headers.add("Content-Range", "bytes " + start + "-" + end + "/" + total);

            return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                    .headers(headers)
                    .contentLength(len)
                    .body(new InputStreamResource(progressIs));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }

    // ===== DELETE =====
    @DeleteMapping("/{name}")
    public ResponseEntity<Map<String, Object>> deleteFile(@PathVariable String name) {
        try {
            // Chặn path traversal
            if (name.contains("..") || name.contains("/") || name.contains("\\")) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("message", "Invalid file name."));
            }
            Path file = ROOT.resolve(name).normalize();

            if (!Files.exists(file)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("message", "File not found."));
            }

            Files.delete(file);
            return ResponseEntity.ok(Map.of("message", "File deleted successfully.", "fileName", name));

        } catch (IOException e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error deleting file.", "error", e.getMessage()));
        }
    }

    // ===== UPDATE (Rename) =====
    @PatchMapping("/{name}")
    public ResponseEntity<Map<String, Object>> renameFile(
            @PathVariable String name,
            @RequestBody Map<String, String> payload
    ) {
        String newName = payload.get("newName");

        try {
            // Chặn path traversal
            if (name.contains("..") || name.contains("/") || name.contains("\\") ||
                    newName == null || newName.isBlank() ||
                    newName.contains("..") || newName.contains("/") || newName.contains("\\")) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("message", "Invalid old or new name."));
            }

            Path oldFile = ROOT.resolve(name).normalize();
            Path newFile = ROOT.resolve(newName).normalize();

            if (!Files.exists(oldFile)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("message", "File not found."));
            }

            if (Files.exists(newFile)) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("message", "New file name already exists."));
            }

            Files.move(oldFile, newFile);
            return ResponseEntity.ok(Map.of(
                    "message", "File renamed successfully.",
                    "oldName", name,
                    "newName", newName
            ));

        } catch (IOException e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Error renaming file.", "error", e.getMessage()));
        }
    }

    // ===== LimitedInputStream: giới hạn N bytes (cho Partial) =====
    static class LimitedInputStream extends FilterInputStream {
        private long remaining;
        protected LimitedInputStream(InputStream in, long remaining) { super(in); this.remaining = remaining; }
        @Override public int read(byte[] b, int off, int len) throws IOException {
            if (remaining <= 0) return -1;
            int toRead = (int) Math.min(len, remaining);
            int n = super.read(b, off, toRead);
            if (n > 0) remaining -= n;
            return n;
        }
        @Override public int read() throws IOException {
            if (remaining <= 0) return -1;
            int r = super.read();
            if (r != -1) remaining--;
            return r;
        }
    }

    // ===== ProgressInputStream: bắn progress trong khi đọc =====
    static class ProgressInputStream extends FilterInputStream {
        private final long totalBytes;
        private final String sessionId;
        private final ProgressService progressService;
        private long bytesSent;
        private final long globalOffset;

        protected ProgressInputStream(InputStream in, long totalBytes, String sessionId,
                                      ProgressService progressService, long globalOffset) {
            super(in);
            this.totalBytes = totalBytes;
            this.sessionId = sessionId;
            this.progressService = progressService;
            this.globalOffset = globalOffset;
            this.bytesSent = 0L;
        }

        private void publish(boolean finishing) {
            if (sessionId == null || sessionId.isBlank()) return;
            long sent = globalOffset + bytesSent;
            int percent = (totalBytes > 0) ? (int) Math.min(100, Math.round(sent * 100.0 / totalBytes)) : 0;
            progressService.sendProgress(sessionId, percent, sent, totalBytes);
            if (finishing || sent >= totalBytes) {
                progressService.complete(sessionId);
            }
        }

        @Override public int read() throws IOException {
            int r = super.read();
            if (r != -1) {
                bytesSent++;
                if ((bytesSent & 0x3FFF) == 0) publish(false); // ~16KB/lần
            } else {
                publish(true);
            }
            return r;
        }

        @Override public int read(byte[] b, int off, int len) throws IOException {
            int n = super.read(b, off, len);
            if (n > 0) {
                bytesSent += n;
                if ((bytesSent & 0xFFFF) == 0) publish(false); // ~64KB/lần
            } else if (n == -1) {
                publish(true);
            }
            return n;
        }

        @Override public void close() throws IOException {
            try { publish(true); } finally { super.close(); }
        }
    }
}
