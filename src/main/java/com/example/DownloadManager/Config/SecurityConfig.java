package com.example.DownloadManager.Config;

import com.example.DownloadManager.Security.JwtAuthFilter;
import com.example.DownloadManager.Security.JwtTokenProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.config.Customizer;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.http.HttpMethod;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
    private final JwtTokenProvider tokenProvider;

    @Bean
    public UserDetailsService userDetailsService() {
        UserDetails admin = User.builder()
                .username("admin")
                .password(passwordEncoder().encode("admin123"))
                .roles("ADMIN")
                .build();
        return new InMemoryUserDetailsManager(admin);
    }

    public SecurityConfig(JwtTokenProvider tokenProvider) {
        this.tokenProvider = tokenProvider;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration cfg) throws Exception {
        return cfg.getAuthenticationManager();
    }

    /**
     * SỬA LỖI 2: Thêm một Bean cấu hình CORS đầy đủ
     * Cho phép React (localhost:3000) gọi đến Spring Boot (localhost:8080)
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        // Cho phép domain của React
        configuration.setAllowedOrigins(List.of("http://localhost:3000"));
        // Các phương thức cho phép
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PATCH", "DELETE", "OPTIONS"));
        // Các header cho phép
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "Cache-Control"));
        // Cho phép gửi cookie/credentials
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration); // Áp dụng cho tất cả các đường dẫn
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        var jwtAuthFilter = new JwtAuthFilter(tokenProvider);

        http
                // SỬA LỖI 2 (tiếp theo): Áp dụng Bean CorsConfigurationSource ở trên
                .cors(Customizer.withDefaults())

                // SỬA LỖI 3: Tắt CSRF vì dùng API stateless (JWT)
                .csrf(AbstractHttpConfigurer::disable)

                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        .requestMatchers("/api/auth/login").permitAll()
                        .requestMatchers("/api/auth/me").authenticated()

                        // SỬA LỖI 1: Cho phép truy cập công khai
                        .requestMatchers(HttpMethod.GET, "/api/files").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/files/{name}").permitAll()

                        // Các trang này vẫn cần đăng nhập (nếu có)
                        .requestMatchers("/api/files/events/subscribe").authenticated()
                        .requestMatchers("/api/files/progress/subscribe").authenticated()

                        // Các quyền ADMIN vẫn giữ nguyên
                        .requestMatchers(HttpMethod.POST,   "/api/files/upload").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH,  "/api/files/{name}").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/files/{name}").hasRole("ADMIN")

                        .anyRequest().authenticated()
                );


        http.addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

}
