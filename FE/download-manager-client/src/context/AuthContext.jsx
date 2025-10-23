import React, { createContext, useState, useContext, useEffect, useCallback } from 'react'; // <-- Đã thêm useCallback vào import
import { API_BASE } from '../config'; // <-- Đã thêm import API_BASE

// 1. Tạo Context
const AuthContext = createContext(null);

// 2. Tạo Provider Component
export const AuthProvider = ({ children }) => {
  // State: lưu token và trạng thái loading ban đầu
  // ** QUAN TRỌNG: setAuth được khai báo ở đây **
  const [auth, setAuth] = useState({ token: null, loading: true });

  // --- Logic chính ---

  // ** QUAN TRỌNG: useCallback và các hook khác phải nằm BÊN TRONG component **
  // Hàm kiểm tra token trong localStorage khi tải trang
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

  // HÀM LOGIN
  const login = useCallback(async (username, password) => {
    console.log("AuthContext: Attempting login via context for user:", username);
    let response;
    try {
      response = await fetch(`${API_BASE || ""}/api/auth/login`, { // <-- Gọi API_BASE ở đây là đúng
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      console.log(`AuthContext Login RAW Response Status: ${response.status}`);
      const responseText = await response.text();
      console.log(`AuthContext Login RAW Response Text: ${responseText}`);

      if (!response.ok) {
          let errorMessage = 'Sai tên đăng nhập hoặc mật khẩu';
           try {
               const errorJson = JSON.parse(responseText);
               errorMessage = errorJson.message || errorMessage;
           } catch (parseError) {
                errorMessage = (response.status === 401 || response.status === 403) ? 'Sai tên đăng nhập hoặc mật khẩu' : (responseText || `Lỗi ${response.status}`);
           }
          console.error(`AuthContext Login API failed. Status: ${response.status}, Message: ${errorMessage}`);
          throw new Error(errorMessage);
      }

      let data;
      try {
          data = JSON.parse(responseText);
      } catch (parseError) {
          console.error("AuthContext: Failed to parse successful login response JSON:", parseError, "Raw text:", responseText);
          throw new Error("Phản hồi đăng nhập không hợp lệ.");
      }

      if (data.accessToken) {
        console.log("AuthContext: Login API success. Saving token.");
        localStorage.setItem('token', data.accessToken);
        setAuth({ token: data.accessToken, loading: false }); // <-- Gọi setAuth ở đây là đúng
        return true;
      } else {
        console.error("AuthContext: Login response OK but no accessToken.");
        throw new Error("Không nhận được token truy cập.");
      }
    } catch (error) {
      console.error("AuthContext: Error during login API call:", error);
      localStorage.removeItem('token');
      setAuth({ token: null, loading: false }); // <-- Gọi setAuth ở đây là đúng
      throw error;
    }
  }, []); // useCallback dependencies rỗng

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

