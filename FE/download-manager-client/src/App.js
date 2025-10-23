import React, { useRef } from "react"; // Bỏ useCallback nếu không dùng handleUploaded
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Header from "./header/header";
import HomePage from "./Pages/HomePage";
import UploadPage from "./Pages/UploadPage";
import LoginPage from "./Pages/LoginPage";
import AdminRoute from "./routes/AdminRoute"; // Sửa lại đường dẫn nếu cần
import AdminPage from "./Pages/AdminPage"; // Import AdminPage

export default function App() {
  const adminPageRef = useRef(null); 

  return (
    <Router>
      <div className="page">
        <Header />

        <main className="content">
          <Routes>
            {/* Route trang chủ (công khai) */}
            <Route path="/" 
            element={<HomePage />} />

            {/* Route trang Login (công khai) */}
            <Route path="/login" 
            element={<LoginPage />} />

            <Route path="/upload" element={<UploadPage />} />

            <Route
              path="/admin"
              element={
                <AdminRoute>
                  {/* Sử dụng AdminPage đã tạo */}
                  <AdminPage ref={adminPageRef} /> 
                </AdminRoute>
              }
            />

            {/* Route mặc định: Chuyển về trang chủ */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

