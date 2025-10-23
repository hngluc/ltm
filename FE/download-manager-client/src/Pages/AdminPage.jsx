import React, { useState, useEffect } from "react"; // Thêm useEffect
import { useNavigate } from "react-router-dom";
import { authUpload } from "../api"; 
import "./upload.css"; 

export default function UploadPage({ onUploaded }) { 
  const [files, setFiles] = useState([]); 
  const [uploading, setUploading] = useState(false); 
  const [error, setError] = useState(null); 
  const navigate = useNavigate();

  // State để theo dõi component còn mount không (tránh lỗi state update)
  const [isMounted, setIsMounted] = useState(true);
  useEffect(() => {
      setIsMounted(true);
      // Cleanup function chạy khi component unmount
      return () => {
          console.log("UploadPage unmounting...");
          setIsMounted(false); 
      }
  }, []); // Chỉ chạy 1 lần khi mount

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
      // 1. Gọi authUpload và nhận về đối tượng 'response'
      const response = await authUpload("/files/upload", formData);
      
      // 2. *** KIỂM TRA QUAN TRỌNG ***
      if (!response.ok) {
        // Nếu response không OK (ví dụ: lỗi 400, 500)
        let errorMessage = `Lỗi ${response.status}: ${response.statusText}`;
        try {
          // Thử đọc nội dung lỗi chi tiết từ server
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (jsonError) {
          // Bỏ qua nếu server không trả về JSON
        }
        // Ném lỗi để khối catch bên dưới bắt được
        throw new Error(errorMessage);
      }

      // 3. Nếu response.ok, xử lý kết quả
      const resultData = await response.json(); // Lấy dữ liệu JSON thành công
      console.log("Upload result:", resultData);
      
      // Upload xong, quay về trang chủ
      // navigate sẽ khiến component unmount
      navigate("/");

    } catch (err) {
      // Bắt lỗi (từ authFetch ném ra 401/403, hoặc từ throw new Error ở trên)
      console.error("Upload failed:", err);
      
      // *** SỬA LỖI: Chỉ cập nhật state nếu component còn mount ***
      if (isMounted) {
        setError(`Upload thất bại: ${err.message}`);
      }
    } finally {
      // *** SỬA LỖI: Chỉ cập nhật state nếu component còn mount ***
      if (isMounted) {
        setUploading(false);
      }
    }
  };

  // Render giao diện (đã sửa lỗi JSX)
  return (
    // **SỬA LỖI: Tất cả phải nằm trong 1 div cha**
    <div className="upload-container">
    
      {/* Bạn có 2 bộ input/button, tôi giả định bạn muốn dùng bộ thứ 2 
        với class "upload-action-button" 
      */}

      {/* Input chọn file */}
      <input 
        type="file" 
        multiple 
        onChange={handleFileChange} 
        disabled={uploading} 
        id="file-upload" // Thêm id để label hoạt động
      />
      {/* (Tùy chọn) Thêm label cho đẹp hơn */}
      {/* <label htmlFor="file-upload" className="button">
        {files.length === 0 ? "Chọn file" : `${files.length} file đã chọn`}
      </label> */}

      {/* Button Upload */}
      <button 
        className="button upload-action-button" 
        onClick={handleUpload} 
        disabled={uploading || files.length === 0} 
      >
        {uploading ? 'Đang Upload...' : 'Upload Files'}
      </button>

      {/* Thông báo lỗi */}
      {error && <p className="error-message upload-error">{error}</p>}

    </div>
  );
}