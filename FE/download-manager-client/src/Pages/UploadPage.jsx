import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { authUpload } from "../api"; // <-- 1. Import hàm upload "xịn"
import "./upload.css";

export default function UploadPage({ onUploaded }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    setFiles([...e.target.files]);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("Vui lòng chọn ít nhất 1 file.");
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    try {
      // 2. Sử dụng authUpload thay vì fetch
      const result = await authUpload("/files/upload", formData);
      
      console.log("Upload result:", result);
      
      // (Không cần gọi onUploaded nữa vì SSE đã tự động cập nhật list)
      // onUploaded?.(); 
      
      // Upload xong, quay về trang chủ
      navigate("/");

    } catch (err) {
      console.error("Upload failed:", err);
      setError(`Upload thất bại: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // ... (Phần JSX return giữ nguyên)
  return (
      <div className="upload-container">
        {/* ... (Giữ nguyên JSX) ... */}
      </div>
  );
}
