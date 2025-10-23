// src/Pages/UploadPage.jsx
import React, { useRef, useState } from "react";
import { API_BASE } from "../config"; // ví dụ: "http://localhost:8080/api"

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || busy) return;

    try {
      setBusy(true);
      setStatus("Đang upload…");

      const form = new FormData();
      // TÊN field phải trùng với @RequestParam("file") bên BE
      form.append("file", file);

      const token = localStorage.getItem("token"); // nếu bạn login lưu token ở đây
      const res = await fetch(`${API_BASE}/files/upload`, {
        method: "POST",
        // KHÔNG set "Content-Type" khi gửi FormData (trình duyệt tự thêm boundary)
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
        // Nếu BE dùng cookie-session, cần: credentials: "include"
      });

      if (!res.ok) {
        // đọc thông báo lỗi từ BE (text/json)
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || "Upload failed"}`);
      }

      setStatus("✅ Upload thành công");
      // reset input
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      // nếu muốn refresh HomePage qua SSE thì không cần làm gì thêm
    } catch (err) {
      console.error("Upload error:", err);
      // một số lỗi hay gặp hiển thị dễ hiểu:
      if (String(err).includes("TypeError: Failed to fetch")) {
        setStatus("❌ Không kết nối được server. Kiểm tra API_BASE/CORS/port.");
      } else {
        setStatus(`❌ Upload lỗi: ${err.message}`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>⬆️ Upload file</h2>

      <form onSubmit={handleSubmit} className="form-grid">
        <input
          ref={inputRef}
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button type="submit" disabled={!file || busy}>
          {busy ? "Đang gửi…" : "Upload"}
        </button>
      </form>

      {file && <p className="status">Chọn: <b>{file.name}</b> ({(file.size/1024/1024).toFixed(2)} MB)</p>}
      {status && <p className="status">{status}</p>}
    </div>
  );
}
