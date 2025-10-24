package com.example.DownloadManager.Security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import javax.annotation.PostConstruct;
// Import này cần thiết cho @PostConstruct

// Import này thay thế cho javax.crypto.SecretKey
import java.security.Key;
import java.util.Date;
import java.util.List;

@Component
public class JwtTokenProvider {

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${app.jwt.expiration-ms}")
    private long jwtExpirationMs;

    // Biến này sẽ lưu trữ key đã được giải mã
    private Key key;

    /**
     * Hàm này sẽ tự động chạy MỘT LẦN sau khi component được tạo.
     * Nó giải mã key Base64 từ properties và lưu vào biến 'key'.
     */
    @PostConstruct
    public void init() {
        byte[] keyBytes = Decoders.BASE64.decode(jwtSecret);
        this.key = Keys.hmacShaKeyFor(keyBytes);
    }

    public Claims parseAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key) // Dùng key đã lưu
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    /** Tạo JWT kèm quyền */
    public String generateToken(Authentication authentication) {
        UserDetails user = (UserDetails) authentication.getPrincipal();

        // Lấy danh sách quyền dưới dạng string (vd: "ROLE_ADMIN")
        List<String> authorities = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .toList();

        Date now = new Date();
        Date expiry = new Date(now.getTime() + jwtExpirationMs);

        return Jwts.builder()
                .setSubject(user.getUsername())
                .claim("authorities", authorities)   // ✅ FE sẽ đọc claim này
                .setIssuedAt(now)
                .setExpiration(expiry)
                .signWith(key, SignatureAlgorithm.HS512) // Dùng key đã lưu
                .compact();
    }

    /** Lấy username từ token */
    public String getUsernameFromJWT(String token) {
        Claims claims = Jwts.parserBuilder()
                .setSigningKey(key) // Dùng key đã lưu
                .build()
                .parseClaimsJws(token)
                .getBody();
        return claims.getSubject();
    }

    /** Xác thực token */
    public boolean validateToken(String authToken) {
        try {
            Jwts.parserBuilder()
                    .setSigningKey(key) // Dùng key đã lưu
                    .build()
                    .parseClaimsJws(authToken);
            return true;
        } catch (Exception ex) {
            // Bạn có thể log lỗi chi tiết hơn ở đây nếu muốn
            System.err.println("Invalid JWT token: " + ex.getMessage());
            return false;
        }
    }
}
