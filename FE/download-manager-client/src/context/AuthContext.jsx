import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { API_BASE } from '../config'; // Giả sử bạn có file config

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState({ token: null });

  // 1. Hàm kiểm tra trạng thái đăng nhập khi tải trang
  const checkAuthStatus = useCallback(() => {
    try {
      const token = localStorage.getItem('token');
      console.log("AuthContext: Checking localStorage, token found:", token); // <-- LOG 1
      if (token) {
        setAuth({ token: token });
        console.log("AuthContext: Set auth state with token from localStorage"); // <-- LOG 2
      } else {
        setAuth({ token: null }); // Đảm bảo set về null nếu không có token
        console.log("AuthContext: No token in localStorage, setting auth to null"); // <-- LOG 3
      }
    } catch (error) {
        console.error("AuthContext: Error reading localStorage:", error); // <-- LOG LỖI LOCALSTORAGE
        setAuth({ token: null }); // Đặt lại về null nếu có lỗi
    }
  }, []);

  // Chạy kiểm tra khi component mount lần đầu
  useEffect(() => {
    console.log("AuthContext: AuthProvider mounted, checking auth status..."); // <-- LOG 4
    checkAuthStatus();
  }, [checkAuthStatus]);

  // 2. Hàm đăng nhập
  const login = async (username, password) => {
    try {
      const response = await fetch(`${API_BASE || ""}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.accessToken) {
        localStorage.setItem('token', data.accessToken);
        setAuth({ token: data.accessToken });
        console.log("AuthContext: Login successful, token saved:", data.accessToken); // <-- LOG 5
        return true; // Trả về true nếu thành công
      } else {
        throw new Error("Login failed: No access token received");
      }
    } catch (error) {
      console.error("AuthContext: Login failed:", error); // <-- LOG LỖI LOGIN
      localStorage.removeItem('token'); // Xóa token cũ nếu login lỗi
      setAuth({ token: null });
      throw error; // Ném lỗi ra để LoginPage xử lý
    }
  };

  // 3. Hàm đăng xuất
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setAuth({ token: null });
    console.log("AuthContext: Logged out, token removed"); // <-- LOG 6
  }, []);

  // 4. Giá trị cung cấp cho Context
  const value = {
    // Chuyển đổi trạng thái đăng nhập thành boolean rõ ràng
    isLoggedIn: !!auth.token,
    token: auth.token,
    login,
    logout,
  };

  console.log("AuthContext: Rendering Provider, isLoggedIn:", value.isLoggedIn); // <-- LOG 7

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 5. Hook tùy chỉnh để sử dụng Context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    // Lỗi này xảy ra nếu dùng useAuth bên ngoài AuthProvider
    throw new Error("useAuth must be used within an AuthProvider");
  }
  // console.log("useAuth hook called, returning context:", context); // Tạm thời comment dòng này để đỡ rối
  return context;
};

