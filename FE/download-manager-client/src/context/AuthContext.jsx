import React, { createContext, useState, useContext, useEffect, useCallback } from 'react'; // <-- Đã thêm useCallback vào import
import { API_BASE } from '../config'; // <-- Đã thêm import API_BASE

// 1. Tạo Context
const AuthContext = createContext(null);

// 2. Tạo Provider Component
export const AuthProvider = ({ children }) => {
  // State: lưu token và trạng thái loading ban đầu
  // ** QUAN TRỌNG: setAuth được khai báo ở đây **
  const [auth, setAuth] = useState({ token: null, loading: true });

 
  const checkInitialAuth = useCallback(() => {
    console.log("AuthContext: Checking initial auth status...");
    try {
      const token = localStorage.getItem('token');
      console.log("AuthContext: Token from localStorage on init:", token);
      if (token) {
        setAuth({ token: token, loading: false }); // <-- Gọi setAuth ở đây là đúng
      } else {
        setAuth({ token: null, loading: false }); // <-- Gọi setAuth ở đây là đúng
      }
    } catch (error) {
      console.error("AuthContext: Error reading localStorage on init:", error);
      setAuth({ token: null, loading: false });
    }
  }, []); // useCallback dependencies rỗng

  // Chạy kiểm tra auth khi Provider mount lần đầu
  useEffect(() => {
    checkInitialAuth();
  }, [checkInitialAuth]); // Chỉ chạy 1 lần

 // HÀM LOGIN (đã chỉnh)
const login = useCallback(async (username, password) => {
  console.log("AuthContext: Attempting login via context for user:", username);

  // helper nhỏ để decode payload JWT (base64url)
  const readAuthoritiesFromJwt = (token) => {
    try {
      const part = token.split(".")[1];
      if (!part) return [];
      const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
      const pad = base64.length % 4;
      const fixed = pad ? base64 + "=".repeat(4 - pad) : base64;
      const json = atob(fixed);
      const payload = JSON.parse(json);

      const raw = payload.authorities ?? payload.roles ?? payload.scope ?? payload.role ?? [];
      const list = Array.isArray(raw)
        ? raw
        : typeof raw === "string"
          ? raw.split(/\s+/)
          : [];

      return list.map((x) => (typeof x === "string" ? x : x?.authority || "")).filter(Boolean);
    } catch {
      return [];
    }
  };

  try {
    // Đăng nhập
    const AUTH_BASE  = `${API_BASE}/auth`;
    
    const response = await fetch(`${AUTH_BASE}/login`,
   {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const responseText = await response.text();
    console.log(`AuthContext Login RAW Response Status: ${response.status}`);
    console.log(`AuthContext Login RAW Response Text: ${responseText}`);

    if (!response.ok) {
      let errorMessage = "Sai tên đăng nhập hoặc mật khẩu";
      try {
        const errorJson = JSON.parse(responseText);
        errorMessage = errorJson.message || errorMessage;
      } catch {
        errorMessage =
          response.status === 401 || response.status === 403
            ? "Sai tên đăng nhập hoặc mật khẩu"
            : responseText || `Lỗi ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error("Phản hồi đăng nhập không hợp lệ.");
    }

    const token = data.accessToken;
    if (!token) throw new Error("Không nhận được token truy cập.");

    // Lưu token
    console.log("AuthContext: Login API success. Saving token.");
    localStorage.setItem("token", token);

    // 1) Thử đọc authorities từ JWT
    let authorities = readAuthoritiesFromJwt(token);

    // 2) Nếu JWT không có, gọi /auth/me để lấy quyền và cache
    if (!authorities.length) {
      try {
        const meRes = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meRes.ok) {
          const me = await meRes.json();
          const list = Array.isArray(me.authorities)
            ? me.authorities.map((x) => (typeof x === "string" ? x : x?.authority || ""))
            : [];
          authorities = list;
        }
      } catch (err) {
        console.warn("AuthContext: Could not fetch /auth/me", err);
      }
    }

    if (authorities.length) {
      localStorage.setItem("authorities", JSON.stringify(authorities));
    } else {
      localStorage.removeItem("authorities");
    }

    // Cập nhật context
    setAuth({ token, loading: false });
    return true;
  } catch (error) {
    console.error("AuthContext: Error during login API call:", error);
    localStorage.removeItem("token");
    localStorage.removeItem("authorities");
    setAuth({ token: null, loading: false });
    throw error;
  }
}, []);


  // HÀM LOGOUT
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setAuth({ token: null, loading: false }); // <-- Gọi setAuth ở đây là đúng
    console.log("AuthContext: Logged out, token removed");
  }, []);

  // --- Cung cấp giá trị cho Context ---
  const value = {
    isLoggedIn: !!auth.token,
    token: auth.token,
    isLoading: auth.loading,
    login,
    logout,
  };

  // Không render children cho đến khi kiểm tra auth ban đầu xong
  if (auth.loading) {
     return <div>Authenticating...</div>; // Hoặc spinner
  }

  // Render Context Provider
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; // ** Kết thúc AuthProvider component **


// 3. Tạo Custom Hook để sử dụng Context (Giữ nguyên)
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

