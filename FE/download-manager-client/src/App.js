// src/App.js
import React, { useRef, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from "react-router-dom";
import FileList from "./components/FileList";
import UploadPage from "./Pages/UploadPage";

export default function App() {
  const fileListRef = useRef(null);

  const handleUploaded = useCallback(() => {
    fileListRef.current?.refresh?.();
  }, []);

  return (
    <Router>
      <div className="page">
        <header className="navbar">
          <h1 className="logo">💾 Download Manager</h1>
          <nav className="nav-links">
            <NavLink to="/" end className="button list-button">
              <span className="icon">📁</span> Danh sách
            </NavLink>
            <NavLink to="/upload" className="button upload-button">
              <span className="icon">⬆️</span> Upload
            </NavLink>
          </nav>
        </header>

        <main className="content">
          <Routes>
            <Route path="/" element={<FileList ref={fileListRef} />} />
            <Route path="/upload" element={<UploadPage onUploaded={handleUploaded} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
