// com.example.download.UploadController.java
package com.example.download;

import org.springframework.http.*;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.file.*;

@RestController
@RequestMapping("/api/files")
public class UploadController {

    private final Path sharedDir = Paths.get("shared");

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<String> upload(@RequestParam("file") MultipartFile file) throws Exception {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body("No file");
        }
        Files.createDirectories(sharedDir);

        String filename = StringUtils.cleanPath(file.getOriginalFilename());
        Path dest = sharedDir.resolve(filename);

        try (InputStream in = file.getInputStream()) {
            Files.copy(in, dest, StandardCopyOption.REPLACE_EXISTING);
        }
        return ResponseEntity.ok("OK");
    }
}
