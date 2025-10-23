import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./header.css";

export default function Header() {
  const { isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();

  console.log("Header: Component rendering..."); // Log 1: Bắt đầu render
  console.log("Header: isLoggedIn value:", isLoggedIn); // Log 2: Giá trị isLoggedIn

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // Log 3: Trước khi return JSX
  console.log("Header: About to return JSX...");

  return (
    <header className="navbar">
      <h1 className="logo">💾 Download Manager</h1>
      <nav className="nav-links">
        {/* Log 4: Render nút Danh sách */}
        {console.log("Header: Rendering List button...")}
        <NavLink to="/" end className="button list-button">
          <span className="icon">📁</span> Danh sách
        </NavLink>

        {/* === LOGIC HIỂN THỊ === */}
        {isLoggedIn ? (
          <>
            {/* Log 5a: Render khi isLoggedIn là true */}
            {console.log("Header: Rendering Upload and Logout buttons (isLoggedIn=true)...")}
            <NavLink to="/upload" className="button upload-button">
              <span className="icon">⬆️</span> Upload
            </NavLink>
            <button onClick={handleLogout} className="button logout-button">
              <span className="icon">👋</span> Đăng xuất
            </button>
          </>
        ) : (
          <>
            {/* Log 5b: Render khi isLoggedIn là false */}
            {console.log("Header: Rendering Login button (isLoggedIn=false)...")}
            <NavLink to="/login" className="button login-button">
              <span className="icon">🔑</span> Đăng nhập
            </NavLink>
          </>
        )}
      </nav>
      {/* Log 6: Sau khi render xong nav */}
      {console.log("Header: Finished rendering nav-links")}
    </header>
  );
}

