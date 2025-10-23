import React, { useRef, useCallback } from "react";
// 1. Đảm bảo import đủ các thành phần từ react-router-dom
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"; 
import Header from "./header/header";
import HomePage from "./Pages/HomePage";
import UploadPage from "./Pages/UploadPage";
import LoginPage from "./Pages/LoginPage"; 
import AdminRoute from "./routes/AdminRoute"; 


export default function App() {
  const fileListRef = useRef(null); // Có vẻ ref này không còn cần thiết nếu dùng SSE?

  return (
    <Router> 
      <div className="page">
        <Header />

        <main className="content">
          {/* 5. Khối <Routes> chứa các Route */}
          <Routes> 
            {/* Route trang chủ (công khai) */}
            <Route path="/" element={<HomePage ref={fileListRef} />} /> 

            {/* Route trang Login (công khai) */}
            <Route path="/login" element={<LoginPage />} /> {/* <<<<<< PHẢI CÓ DÒNG NÀY */}

            {/* Route trang Upload (bảo vệ bởi AdminRoute) */}
            <Route 
              path="/upload" 
              element={
                <AdminRoute> {/* Bọc UploadPage bằng AdminRoute */}
                  <UploadPage /* onUploaded={handleUploaded} */ /> 
                </AdminRoute>
              } 
            />

            {/* (Tùy chọn) Có thể thêm Route cho trang Admin Dashboard chính thức sau */}
            {/* <Route 
              path="/admin" 
              element={
                <AdminRoute> 
                  {/* <AdminDashboard /> Thay HomePage bằng component Admin riêng */}
                  {/* Tạm thời có thể dùng lại HomePage nhưng thêm nút Delete/Rename */}
                  {/* <HomePage isAdmin={true} ref={fileListRef} /> */}
                {/* </AdminRoute>
              } 
            /> */}


            {/* Route mặc định: Nếu không khớp các route trên, quay về trang chủ */}
            <Route path="*" element={<Navigate to="/" replace />} /> 
          </Routes>
        </main>
      </div>
    </Router>
  );
}

