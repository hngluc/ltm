package com.example.DownloadManager;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.Map;

public class ResumeDownloadClient {
    private static final int BUFFER_SIZE = 64 * 1024;     // 64KB
    private static final int FLUSH_EVERY_BYTES = 1_000_000; // flush & lưu tiến độ mỗi ~1MB

    public static void main(String[] args) throws Exception {
        if (args.length < 3) {
            System.out.println("Cách dùng:");
            System.out.println("  java com.example.DownloadManager.ResumeDownloadClient <BASE_URL> <remoteFileName> <outputDir>");
            System.out.println("Ví dụ:");
            System.out.println("  java ... http://localhost:8080/files/download?name= big.bin  ./downloads");
            return;
        }

        String baseUrl = args[0];       // ví dụ: http://localhost:8080/files/download?name=
        String remoteName = args[1];    // ví dụ: big.bin
        Path outputDir = Paths.get(args[2]).toAbsolutePath();

        Files.createDirectories(outputDir);

        String url = baseUrl.endsWith("=") || baseUrl.contains("?")
                ? baseUrl + remoteName
                : baseUrl + "/" + remoteName;

        Path target = outputDir.resolve(remoteName);
        downloadWithResume(url, target);
    }

    public static void downloadWithResume(String fileUrl, Path targetPath) throws IOException {
        Path resumePath = targetPath.resolveSibling(targetPath.getFileName().toString() + ".resume.json");

        // Tải meta nếu đã có
        ResumeMeta meta = ResumeMeta.load(resumePath);

        long existingSize = Files.exists(targetPath) ? Files.size(targetPath) : 0L;
        long startByte = Math.max(existingSize, meta.downloadedBytes);

        // Yêu cầu HEAD nhẹ để lấy ETag/Length (nếu muốn chặt chẽ hơn)
        String etag = null;
        long remoteLength = -1;
        try {
            HttpURLConnection head = (HttpURLConnection) new URL(fileUrl).openConnection();
            head.setRequestMethod("HEAD");
            head.setConnectTimeout(10_000);
            head.setReadTimeout(10_000);
            head.connect();
            etag = head.getHeaderField("ETag");
            String len = head.getHeaderField("Content-Length");
            if (len != null && !len.isBlank()) remoteLength = parseLongSafe(len, -1);
            head.disconnect();
        } catch (Exception ignore) {}

        // Nếu ETag thay đổi so với lần trước -> tải mới
        if (etag != null && meta.etag != null && !etag.equals(meta.etag)) {
            System.out.println("ETag đã thay đổi, bắt đầu tải mới...");
            Files.deleteIfExists(targetPath);
            Files.deleteIfExists(resumePath);
            startByte = 0;
            meta = new ResumeMeta(); // reset
        }

        System.out.printf("Bắt đầu tải: %s%n", fileUrl);
        if (startByte > 0) {
            System.out.printf("Tiếp tục từ byte: %,d%n", startByte);
        }

        HttpURLConnection conn = (HttpURLConnection) new URL(fileUrl).openConnection();
        conn.setConnectTimeout(15_000);
        conn.setReadTimeout(30_000);

        if (startByte > 0) {
            conn.setRequestProperty("Range", "bytes=" + startByte + "-");
        }

        int code = conn.getResponseCode();
        if (startByte > 0 && code != HttpURLConnection.HTTP_PARTIAL) {
            // Server không trả 206 -> tải lại từ đầu (dọn phần cũ để tránh lỗi trùng)
            System.out.println("Server không hỗ trợ tiếp tục (không trả 206). Tải lại từ đầu…");
            conn.disconnect();
            Files.deleteIfExists(targetPath);
            Files.deleteIfExists(resumePath);
            meta = new ResumeMeta();
            startByte = 0;
            conn = (HttpURLConnection) new URL(fileUrl).openConnection();
        }

        // Cập nhật meta
        String contentRange = conn.getHeaderField("Content-Range"); // ví dụ: bytes 100-999/12345
        if (contentRange != null) {
            long total = parseTotalFromContentRange(contentRange);
            if (total > 0) meta.totalBytes = total;
        } else if (remoteLength > 0) {
            meta.totalBytes = remoteLength;
        }
        if (etag == null) etag = conn.getHeaderField("ETag");
        if (etag != null) meta.etag = etag;

        try (InputStream in = getInputStream(conn);
             RandomAccessFile raf = openRandomAccessFile(targetPath, startByte)) {

            byte[] buf = new byte[BUFFER_SIZE];
            long writtenSinceFlush = 0;
            long downloaded = startByte;

            long lastPrint = System.currentTimeMillis();

            while (true) {
                int n = in.read(buf);
                if (n == -1) break;
                raf.write(buf, 0, n);
                downloaded += n;
                writtenSinceFlush += n;

                // Lưu tiến độ định kỳ
                if (writtenSinceFlush >= FLUSH_EVERY_BYTES) {
                    raf.getFD().sync();
                    meta.downloadedBytes = downloaded;
                    meta.save(resumePath);
                    writtenSinceFlush = 0;
                }

                // In tiến trình “nhẹ”
                if (System.currentTimeMillis() - lastPrint > 500) {
                    printProgress(downloaded, meta.totalBytes);
                    lastPrint = System.currentTimeMillis();
                }
            }

            // Hoàn tất
            raf.getFD().sync();
            meta.downloadedBytes = downloaded;
            meta.save(resumePath);

            System.out.println();
            System.out.println("Tải xong!");

        } catch (IOException ex) {
            // Bắt lỗi gián đoạn: lưu lại tiến độ hiện tại trước khi ném lỗi ra
            meta.downloadedBytes = Files.exists(targetPath) ? Files.size(targetPath) : 0L;
            meta.save(resumePath);
            System.err.println("Gián đoạn: đã lưu tiến độ vào " + resumePath.getFileName());
            throw ex;
        } finally {
            conn.disconnect();
        }

        // Nếu đủ tổng dung lượng -> xóa file resume
        if (meta.totalBytes > 0 && Files.size(targetPath) >= meta.totalBytes) {
            Files.deleteIfExists(resumePath);
        }
    }

    // ===== Helpers =====

    private static InputStream getInputStream(HttpURLConnection conn) throws IOException {
        InputStream in;
        try {
            in = conn.getInputStream();
        } catch (IOException ioe) {
            InputStream err = conn.getErrorStream();
            if (err != null) err.close();
            throw ioe;
        }
        return new BufferedInputStream(in, BUFFER_SIZE);
    }

    private static RandomAccessFile openRandomAccessFile(Path target, long startByte) throws IOException {
        Files.createDirectories(target.getParent());
        RandomAccessFile raf = new RandomAccessFile(target.toFile(), "rw");
        if (startByte > 0) {
            raf.seek(startByte);
        } else {
            raf.setLength(0); // tải mới
        }
        return raf;
    }

    private static long parseTotalFromContentRange(String contentRange) {
        // dạng "bytes <start>-<end>/<total>"
        int slash = contentRange.lastIndexOf('/');
        if (slash > 0 && slash < contentRange.length() - 1) {
            return parseLongSafe(contentRange.substring(slash + 1).trim(), -1);
        }
        return -1;
    }

    private static long parseLongSafe(String s, long def) {
        try { return Long.parseLong(s); } catch (Exception e) { return def; }
    }

    private static void printProgress(long downloaded, long total) {
        if (total > 0) {
            double pct = (downloaded * 100.0) / total;
            System.out.printf("\rĐã tải: %,d / %,d (%.2f%%)", downloaded, total, pct);
        } else {
            System.out.printf("\rĐã tải: %,d bytes", downloaded);
        }
    }

    /** Dữ liệu tiến độ lưu trong .resume.json */
    static class ResumeMeta {
        long downloadedBytes = 0;
        long totalBytes = -1;
        String etag = null;

        static ResumeMeta load(Path p) {
            if (!Files.exists(p)) return new ResumeMeta();
            try {
                String json = Files.readString(p, StandardCharsets.UTF_8).trim();
                Map<String, Object> m = Json.minimalParse(json);
                ResumeMeta meta = new ResumeMeta();
                meta.downloadedBytes = ((Number)m.getOrDefault("downloadedBytes", 0)).longValue();
                Object t = m.get("totalBytes");
                if (t instanceof Number) meta.totalBytes = ((Number) t).longValue();
                Object e = m.get("etag");
                if (e != null) meta.etag = e.toString();
                return meta;
            } catch (Exception e) {
                return new ResumeMeta();
            }
        }

        void save(Path p) {
            String json = Json.minimalString(Map.of(
                    "downloadedBytes", downloadedBytes,
                    "totalBytes", totalBytes,
                    "etag", etag == null ? "" : etag
            ));
            try {
                Files.writeString(p, json, StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            } catch (IOException ignored) {}
        }
    }

    /** Trình tối giản JSON (không phụ thuộc lib ngoài) */
    static class Json {
        static String minimalString(Map<String, ?> map) {
            StringBuilder sb = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<String, ?> e : map.entrySet()) {
                if (!first) sb.append(',');
                first = false;
                sb.append('"').append(escape(e.getKey())).append('"').append(':');
                Object v = e.getValue();
                if (v == null) sb.append("null");
                else if (v instanceof Number || v instanceof Boolean) sb.append(v.toString());
                else sb.append('"').append(escape(String.valueOf(v))).append('"');
            }
            sb.append('}');
            return sb.toString();
        }

        @SuppressWarnings("unchecked")
        static Map<String, Object> minimalParse(String json) {
            // chỉ parse rất đơn giản cho { "k": v } với v là số/chuỗi
            // không dùng để parse JSON phức tạp.
            java.util.LinkedHashMap<String, Object> out = new java.util.LinkedHashMap<>();
            String s = json.trim();
            if (s.startsWith("{") && s.endsWith("}")) {
                s = s.substring(1, s.length() - 1).trim();
                if (!s.isEmpty()) {
                    for (String part : s.split(",")) {
                        String[] kv = part.split(":", 2);
                        if (kv.length != 2) continue;
                        String k = unquote(kv[0].trim());
                        String v = kv[1].trim();
                        if (v.startsWith("\"") && v.endsWith("\"")) {
                            out.put(k, unquote(v));
                        } else if (v.equals("null")) {
                            out.put(k, null);
                        } else {
                            try {
                                out.put(k, Long.parseLong(v));
                            } catch (Exception e) {
                                out.put(k, v);
                            }
                        }
                    }
                }
            }
            return out;
        }

        private static String escape(String s) {
            return s.replace("\\", "\\\\").replace("\"", "\\\"");
        }
        private static String unquote(String s) {
            if (s.startsWith("\"") && s.endsWith("\"")) s = s.substring(1, s.length() - 1);
            return s.replace("\\\"", "\"").replace("\\\\", "\\");
        }
    }
}
