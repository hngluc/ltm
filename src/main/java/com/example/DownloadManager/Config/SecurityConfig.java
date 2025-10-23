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

    // Bean SecurityFilterChain (Hoàn chỉnh)
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtAuthFilter jwtAuthFilter) throws Exception {
        http
                // ***** THÊM LẠI 2 DÒNG NÀY *****
                // 1. Tắt CSRF (quan trọng cho API stateless)
                .csrf(AbstractHttpConfigurer::disable)
                // 2. Áp dụng cấu hình CORS (dùng default hoặc bean CorsConfigurationSource của bạn)
                .cors(Customizer.withDefaults())
                // ******************************

                // Không tạo session
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                // Phân quyền request (Giữ nguyên phần này)
                .authorizeHttpRequests(authz -> authz
                        .requestMatchers("/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.GET, "/files").permitAll()
                        .requestMatchers(HttpMethod.GET, "/files/{name}").permitAll()
                        .requestMatchers("/files/progress/subscribe").permitAll()
                        .requestMatchers("/files/events/subscribe").permitAll()
                        .requestMatchers(HttpMethod.POST, "/files/upload").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/files/{name}").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/files/{name}").hasRole("ADMIN")
                        .anyRequest().authenticated()
                );

        // Thêm bộ lọc JWT (Giữ nguyên)
        http.addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}

