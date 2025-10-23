import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { API_BASE } from '../config'; // Giả sử bạn có file config

// 1. Tạo Context
const AuthContext = createContext(null);

// 2. Tạo Provider Component
export const AuthProvider = ({ children }) => {
  // State: lưu token và trạng thái loading ban đầu
  const [auth, setAuth] = useState({ token: null, loading: true }); 

  // --- Logic chính ---

  // Hàm kiểm tra token trong localStorage khi tải trang
  const checkInitialAuth = useCallback(() => {
    console.log("AuthContext: Checking initial auth status...");
    try {
      const token = localStorage.getItem('token');
      console.log("AuthContext: Token from localStorage on init:", token);
      if (token) {
        // TODO: Lý tưởng nhất là thêm bước gọi API backend để xác thực token này còn hạn/hợp lệ không
        // Ví dụ: GET /api/auth/validate -> trả về true/false
        // Nếu validate ok thì setAuth, nếu không thì remove token & setAuth(null)
        setAuth({ token: token, loading: false });
      } else {
        setAuth({ token: null, loading: false });
      }
    } catch (error) {
      console.error("AuthContext: Error reading localStorage on init:", error);
      setAuth({ token: null, loading: false }); // Đảm bảo hết loading dù lỗi
    }
  }, []);

  // Chạy kiểm tra auth khi Provider mount lần đầu
  useEffect(() => {
    checkInitialAuth();
  }, [checkInitialAuth]); // Chỉ chạy 1 lần

  // HÀM LOGIN (Quan trọng: Xử lý API call tại đây)
  const login = useCallback(async (username, password) => {
    console.log("AuthContext: Attempting login via context for user:", username);
    try {
      const response = await fetch(`${API_BASE || ""}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const responseText = await response.text(); // Đọc text trước
      console.log(`AuthContext Login API Status: ${response.status}`);

      if (!response.ok) {
          let errorMessage = 'Sai tên đăng nhập hoặc mật khẩu';
           try {
               const errorJson = JSON.parse(responseText);
               errorMessage = errorJson.message || errorMessage;
           } catch (parseError) {
                errorMessage = (response.status === 401 || response.status === 403) ? 'Sai tên đăng nhập hoặc mật khẩu' : (responseText || `Lỗi ${response.status}`);
           }
          console.error(`AuthContext Login API failed. Status: ${response.status}, Message: ${errorMessage}`);
          throw new Error(errorMessage); // Ném lỗi ra cho LoginPage hiển thị
      }

      // --- Thành công ---
      let data;
      try {
          data = JSON.parse(responseText);
      } catch (parseError) {
          console.error("AuthContext: Failed to parse successful login response JSON:", parseError);
          throw new Error("Phản hồi đăng nhập không hợp lệ.");
      }

      if (data.accessToken) {
        console.log("AuthContext: Login API success. Saving token.");
        // **LƯU Ý THỨ TỰ:** Lưu localStorage TRƯỚC khi set State
        localStorage.setItem('token', data.accessToken); 
        setAuth({ token: data.accessToken, loading: false }); // Cập nhật state
        return true; // Báo thành công cho LoginPage
      } else {
        console.error("AuthContext: Login response OK but no accessToken.");
        throw new Error("Không nhận được token truy cập.");
      }
    } catch (error) {
      console.error("AuthContext: Error during login API call:", error);
      localStorage.removeItem('token'); // Dọn dẹp token cũ nếu login lỗi
      setAuth({ token: null, loading: false }); // Reset state
      throw error; // Ném lỗi ra cho LoginPage
    }
  }, []); // useCallback dependencies rỗng

  // HÀM LOGOUT
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setAuth({ token: null, loading: false }); // Reset state và loading
    console.log("AuthContext: Logged out, token removed");
    // Có thể thêm navigate('/') ở đây nếu muốn logout luôn về trang chủ
    // import { useNavigate } from 'react-router-dom'; // cần import nếu dùng
    // const navigate = useNavigate(); navigate('/');
  }, []);

  // --- Cung cấp giá trị cho Context ---
  const value = {
    isLoggedIn: !!auth.token, // Chuyển thành boolean
    token: auth.token,
    isLoading: auth.loading, // Trạng thái loading ban đầu
    login,                   // Hàm login đã bao gồm gọi API
    logout,
  };

  // console.log("AuthContext: Rendering Provider...", value); // Log khi render (có thể hơi nhiều)

  // Không render children cho đến khi kiểm tra auth ban đầu xong
  // (Quan trọng để tránh component con chạy với state sai)
  if (auth.loading) {
     return <div>Authenticating...</div>; // Hoặc spinner
  }

  // Render Context Provider với giá trị đã tính toán
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 3. Tạo Custom Hook để sử dụng Context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    // Lỗi này xảy ra nếu dùng useAuth bên ngoài AuthProvider
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

