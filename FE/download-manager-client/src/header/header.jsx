import React from "react"; // Bỏ useContext vì dùng useAuth()
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // <-- Import hook useAuth
import "./header.css";

export default function Header() {
  const { isLoggedIn, logout } = useAuth(); // <-- Lấy trạng thái và hàm logout
  const navigate = useNavigate();

  // Thêm console log để kiểm tra
  console.log("Header isLoggedIn:", isLoggedIn); 

  const handleLogout = () => {
    logout();
    navigate("/"); // Chuyển về trang chủ sau khi logout
  };

  return (
    <header className="navbar">
      <h1 className="logo">💾 Download Manager</h1>
      <nav className="nav-links">
        <NavLink to="/" end className="button list-button">
          <span className="icon">📁</span> Danh sách
        </NavLink>

        {/* === LOGIC HIỂN THỊ === */}
        {isLoggedIn ? (
          <>
            {/* Đã đăng nhập */}
            <NavLink to="/upload" className="button upload-button">
              <span className="icon">⬆️</span> Upload
            </NavLink>
            <button onClick={handleLogout} className="button logout-button">
              <span className="icon">👋</span> Đăng xuất
            </button>
          </>
        ) : (
          <>
            {/* Chưa đăng nhập (ẩn nút Upload) */}
            <NavLink to="/login" className="button login-button">
              <span className="icon">🔑</span> Đăng nhập
            </NavLink>
          </>
        )}
        {/* === KẾT THÚC LOGIC === */}
      </nav>
    </header>
  );
}

