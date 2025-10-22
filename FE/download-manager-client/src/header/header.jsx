import React, { useContext } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext"; // Import AuthContext
import "./header.css";

export default function Header() {
  // Lấy trạng thái auth và hàm logout từ Context
  const { auth, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login"); // Chuyển về trang login sau khi logout
  };

  return (
    <header className="navbar">
      <h1 className="logo">💾 Download Manager</h1>
      <nav className="nav-links">
        {/* Các link cũ */}
        <NavLink to="/" end className="button list-button">
          <span className="icon">📁</span> Danh sách
        </NavLink>
        <NavLink to="/upload" className="button upload-button">
          <span className="icon">⬆️</span> Upload
        </NavLink>

        {/* THÊM LOGIC LOGIN/LOGOUT TẠI ĐÂY 
        */}
        {auth.token ? (
          // Đã đăng nhập -> Hiển thị nút Logout
          <button onClick={handleLogout} className="button logout-button">
            <span className="icon">👋</span> Logout
          </button>
        ) : (
          // Chưa đăng nhập -> Hiển thị nút Login
          <NavLink to="/login" className="button login-button">
            <span className="icon">🔑</span> Login
          </NavLink>
        )}
      </nav>
    </header>
  );
}

