package com.example.DownloadManager.Security;

import io.jsonwebtoken.Claims;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;

public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;

    public JwtAuthFilter(JwtTokenProvider tokenProvider) {
        this.tokenProvider = tokenProvider;
    }

    private String resolveToken(HttpServletRequest request) {
        String bearer = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (StringUtils.hasText(bearer) && bearer.startsWith("Bearer ")) {
            return bearer.substring(7);
        }
        return null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        try {
            String token = resolveToken(request);
            if (StringUtils.hasText(token) && tokenProvider.validateToken(token)) {
                // Lấy claims để lấy cả subject lẫn authorities
                Claims claims = tokenProvider.parseAllClaims(token);
                String username = claims.getSubject();
                @SuppressWarnings("unchecked")
                List<String> roles = (List<String>) claims.get("authorities");

                var authorities = (roles == null ? List.<String>of() : roles)
                        .stream()
                        .map(SimpleGrantedAuthority::new)
                        .collect(Collectors.toList());

                Authentication auth =
                        new UsernamePasswordAuthenticationToken(username, null, authorities);
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        } catch (Exception ex) {
            // Không ném exception để tránh ngắt toàn bộ pipeline
            // Log nhẹ nhàng là đủ
            System.err.println("JWT filter error: " + ex.getMessage());
        }
        chain.doFilter(request, response);
    }
}
