package com.example.DownloadManager.Config;

import com.example.DownloadManager.Security.JwtAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer; // Dùng thay cho csrf.disable()
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
// Import Customizer (nếu dùng cors(Customizer.withDefaults()))
import org.springframework.security.config.Customizer;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    // Bean UserDetailsService (Giữ nguyên)
    @Bean
    public UserDetailsService userDetailsService() {
        UserDetails admin = User.builder()
                .username("admin")
                .password(passwordEncoder().encode("admin123"))
                .roles("ADMIN")
                .build();
        return new InMemoryUserDetailsManager(admin);
    }

    // Bean PasswordEncoder (Giữ nguyên)
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // Bean AuthenticationManager (Cách lấy mới, không dùng HttpSecurity)
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration) throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }

    // Bean SecurityFilterChain (Cập nhật cú pháp mới hơn)
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtAuthFilter jwtAuthFilter) throws Exception { // Nhớ inject JwtAuthFilter ở đây
        http
                // ... (csrf, cors, sessionManagement) ...
                .authorizeHttpRequests(authz -> authz
                        .requestMatchers("/api/auth/login").permitAll()       // API Đăng nhập
                        .requestMatchers(HttpMethod.GET, "/files").permitAll() // API Lấy danh sách file (QUAN TRỌNG)
                        .requestMatchers(HttpMethod.GET, "/files/{name}").permitAll() // API Tải file
                        .requestMatchers("/files/progress/subscribe").permitAll() // SSE Progress (QUAN TRỌNG)
                        .requestMatchers("/files/events/subscribe").permitAll() // SSE File List (QUAN TRỌNG)

                        // --- Các đường dẫn yêu cầu ADMIN ---
                        .requestMatchers(HttpMethod.POST, "/files/upload").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/files/{name}").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/files/{name}").hasRole("ADMIN")

                        // --- Mọi request khác cần đăng nhập ---
                        .anyRequest().authenticated()
                );

        // Thêm bộ lọc JWT (Inject trực tiếp vào phương thức thay vì field)
        http.addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}

