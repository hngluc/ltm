// src/App.js
import React, { useRef, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import FileList from "./components/FileList";
import UploadPage from "./Pages/UploadPage";

export default function App() {
  const fileListRef = useRef(null);

  // callback cho UploadPage: khi upload xong thì refresh list
  const handleUploaded = useCallback(() => {
    fileListRef.current?.refresh?.();
  }, []);

  return (
    <Router>
      <div className="page">
        <header className="navbar">
          <h1 className="logo">💾 Download Manager</h1>
          <nav className="nav-links">
            <Link to="/">📁 Danh sách</Link>
            <Link to="/upload">⬆️ Upload</Link>
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
