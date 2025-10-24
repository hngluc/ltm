package com.example.DownloadManager.Controller;

import com.example.DownloadManager.Payload.LoginRequest;
import com.example.DownloadManager.Payload.LoginResponse;
import com.example.DownloadManager.Security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;            // ✅ import
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    AuthenticationManager authenticationManager;

    @Autowired
    JwtTokenProvider tokenProvider;

    // ✅ Đúng path: /api/auth/me
    @GetMapping("/me")
    public Map<String, Object> me(Authentication auth) {
        List<String> roles = auth.getAuthorities()
                .stream()
                .map(GrantedAuthority::getAuthority)
                .toList();
        return Map.of(
                "username", auth.getName(),
                "authorities", roles
        );
    }

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@RequestBody LoginRequest loginRequest) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            loginRequest.getUsername(),
                            loginRequest.getPassword()
                    )
            );
            SecurityContextHolder.getContext().setAuthentication(authentication);

            // ✅ JWT nên chứa authorities để FE đọc vai trò
            String jwt = tokenProvider.generateToken(authentication);

            return ResponseEntity.ok(new LoginResponse(jwt)); // LoginResponse trả về accessToken + tokenType
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(401).body("Username or password incorrect");
        } catch (Exception e) {
            return ResponseEntity.status(401).body("Authentication failed: " + e.getMessage());
        }
    }
}
