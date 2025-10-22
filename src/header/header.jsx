import React from "react";
import { Link } from "react-router-dom";
import "./header.css";

export default function Header() {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <h1 className="logo">💾 Download Manager</h1>
        <nav className="nav-links">
          <Link to="/" className="nav-link">📁 Danh sách</Link>
          <Link to="/upload" className="nav-link upload">⬆️ Upload</Link>
        </nav>
      </div>
    </header>
  );
}
