import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // <-- 1. Import
import "./header.css";

export default function Header() {
  const auth = useAuth(); // <-- 2. Lấy context
  const navigate = useNavigate();

  const handleLogout = () => {
    auth.logout();
    navigate("/"); // Chuyển về trang chủ sau khi logout
  };

  return (
    <header className="navbar">
      <h1 className="logo">💾 Download Manager</h1>
      <nav className="nav-links">
        {/* --- 3. Logic hiển thị --- */}
        <NavLink to="/" end className="button list-button">
          <span className="icon">📁</span> Danh sách
        </NavLink>

        {auth.isLoggedIn ? (
          <>
            {/* Đã đăng nhập */}
            <NavLink to="/upload" className="button upload-button">
              <span className="icon">⬆️</span> Upload
            </NavLink>
            <button onClick={handleLogout} className="button logout-button">
              <span className="icon"></span> Đăng xuất
            </button>
          </>
        ) : (
          <>
            {/* Chưa đăng nhập */}
            <NavLink to="/login" className="button login-button">
              <span className="icon"></span> Đăng nhập
            </NavLink>
          </>
        )}
      </nav>
    </header>
  );
}
