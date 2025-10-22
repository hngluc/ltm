package com.example.DownloadManager;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.SecureRandom;

@Configuration
public class SharedBootstrap {

    private static final Path ROOT = Paths.get("shared");

    @Bean
    ApplicationRunner initSharedFolder() {
        return args -> {
            // Tạo thư mục shared nếu chưa có
            Files.createDirectories(ROOT);

            // 1) Tạo file README mẫu (nếu chưa tồn tại)
            Path readme = ROOT.resolve("readme.txt");
            if (Files.notExists(readme)) {
                String content = """
                        Download Manager demo

                        Thư mục này chứa các file mẫu để tải qua API:
                        - readme.txt (file hướng dẫn)
                        - sample.bin (file nhị phân 1MB để test Range/Resume)

                        Bạn có thể thêm file của riêng bạn vào đây.
                        """;
                Files.writeString(readme, content, StandardCharsets.UTF_8, StandardOpenOption.CREATE_NEW);
            }

            // 2) Tạo file nhị phân 1MB để test (nếu chưa có)
            Path bin = ROOT.resolve("sample.bin");
            if (Files.notExists(bin)) {
                createRandomBinary(bin, 1 * 1024 * 1024); // 1MB
            }

            // (Tuỳ chọn) tạo thêm file .pdf/.zip giả lập nếu bạn muốn
            // Path pdf = ROOT.resolve("demo.pdf");
            // if (Files.notExists(pdf)) Files.write(pdf, "%PDF-1.4\\n%…".getBytes(StandardCharsets.UTF_8));
        };
    }

    /** Tạo file nhị phân ngẫu nhiên dung lượng sizeBytes */
    private static void createRandomBinary(Path path, int sizeBytes) throws IOException {
        SecureRandom random = new SecureRandom();
        byte[] buffer = new byte[64 * 1024]; // 64KB/buffer
        int remaining = sizeBytes;

        try (OutputStream out = Files.newOutputStream(path, StandardOpenOption.CREATE_NEW)) {
            while (remaining > 0) {
                int n = Math.min(remaining, buffer.length);
                random.nextBytes(buffer);
                out.write(buffer, 0, n);
                remaining -= n;
            }
        }
    }
}
