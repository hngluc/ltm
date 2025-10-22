package com.example.DownloadManager.Config;

import com.example.DownloadManager.Security.JwtAuthFilter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Autowired
    private JwtAuthFilter jwtAuthFilter;

    // (Đơn giản) Tạo một user admin trong bộ nhớ
    // TODO: Thay thế bằng logic lấy user từ database
    @Bean
    public UserDetailsService userDetailsService() {
        UserDetails admin = User.builder()
                .username("admin")
                .password(passwordEncoder().encode("admin123")) // Mật khẩu là "admin123"
                .roles("ADMIN")
                .build();
        return new InMemoryUserDetailsManager(admin);
    }

    // Bean để mã hóa mật khẩu
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // Bean AuthenticationManager (cần cho AuthController)
    @Bean
    public AuthenticationManager authenticationManager(HttpSecurity http) throws Exception {
        return http.getSharedObject(AuthenticationManagerBuilder.class)
                .userDetailsService(userDetailsService())
                .passwordEncoder(passwordEncoder())
                .and()
                .build();
    }

    // Bean cấu hình chuỗi Filter bảo mật (quan trọng nhất)
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable()) // Tắt CSRF (vì dùng JWT)
                .cors(Customizer.withDefaults()) // Sử dụng cấu hình CORS của bạn
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)) // Không dùng session
                .authorizeHttpRequests(authz -> authz
                        // --- Cho phép tất cả (Public) ---
                        .requestMatchers("/api/auth/login").permitAll() // API Đăng nhập
                        .requestMatchers(HttpMethod.GET, "/files").permitAll() // API Lấy danh sách file
                        .requestMatchers(HttpMethod.GET, "/files/{name}").permitAll() // API Tải file
                        .requestMatchers("/files/progress/subscribe").permitAll() // SSE Progress
                        .requestMatchers("/files/events/subscribe").permitAll() // SSE File List

                        // --- Yêu cầu quyền ADMIN ---
                        .requestMatchers(HttpMethod.POST, "/files/upload").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/files/{name}").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/files/{name}").hasRole("ADMIN")

                        // Bất kỳ request nào khác đều cần xác thực
                        .anyRequest().authenticated()
                );

        // Thêm bộ lọc JWT của chúng ta vào trước bộ lọc mặc định
        http.addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
