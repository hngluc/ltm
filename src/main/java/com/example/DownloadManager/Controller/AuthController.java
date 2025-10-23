package com.example.DownloadManager.Controller;

import com.example.DownloadManager.Payload.LoginRequest;
import com.example.DownloadManager.Payload.LoginResponse;
import com.example.DownloadManager.Security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException; // <-- Thêm import
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
// Bỏ @CrossOrigin ở đây nếu bạn đã cấu hình global CORS trong SecurityConfig hoặc CorsConfig
// @CrossOrigin(origins = "http://localhost:3000")
public class AuthController {

    @Autowired
    AuthenticationManager authenticationManager;

    @Autowired
    JwtTokenProvider tokenProvider;

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@RequestBody LoginRequest loginRequest) {

        System.out.println("Attempting login for user: " + loginRequest.getUsername()); // <-- LOG 1

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            loginRequest.getUsername(),
                            loginRequest.getPassword()
                    )
            );

            System.out.println("Authentication successful for user: " + loginRequest.getUsername()); // <-- LOG 2

            SecurityContextHolder.getContext().setAuthentication(authentication);
            String jwt = tokenProvider.generateToken(authentication);

            System.out.println("Generated JWT for user: " + loginRequest.getUsername()); // <-- LOG 3

            return ResponseEntity.ok(new LoginResponse(jwt));

        } catch (BadCredentialsException e) {
            // Đây là lỗi khi username/password không khớp
            System.err.println("Login failed for user " + loginRequest.getUsername() + ": Bad credentials"); // <-- LOG LỖI 1
            return ResponseEntity.status(401).body("Username or password incorrect"); // Trả về lỗi 401 Unauthorized
        } catch (Exception e) {
            // Bắt các lỗi xác thực khác (ví dụ: user bị khóa,...)
            System.err.println("Authentication failed for user " + loginRequest.getUsername() + ": " + e.getMessage()); // <-- LOG LỖI 2
            e.printStackTrace(); // In chi tiết lỗi ra console backend
            return ResponseEntity.status(401).body("Authentication failed: " + e.getMessage());
        }
    }
}

