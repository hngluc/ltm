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
      form.append("files", file); 

const token = localStorage.getItem("token");
const res = await fetch(`${API_BASE}/files/upload`, {
  method: "POST",
  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  body: form,
});
if (!res.ok) {
  const text = await res.text();
  throw new Error(`HTTP ${res.status}: ${text}`);
}
      setStatus("✅ Upload thành công");
      if (inputRef.current) inputRef.current.value = "";
      setFile(null);
    } catch (err) {
      console.error("Upload error:", err);
      if (String(err).includes("TypeError: Failed to fetch"))
        setStatus("❌ Không kết nối được server (API_BASE/CORS/port).");
      else
        setStatus(`❌ Upload lỗi: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel" style={{padding:16}}>
      <h2>⬆️ Upload file</h2>
      <form onSubmit={handleSubmit} className="form-grid">
        <input ref={inputRef} type="file" onChange={e=>setFile(e.target.files?.[0]??null)} />
        <button type="submit" disabled={!file || busy}>{busy ? "Đang gửi…" : "Upload"}</button>
      </form>
      {file && <p>Chọn: <b>{file.name}</b> ({(file.size/1024/1024).toFixed(2)} MB)</p>}
      {status && <p className="status">{status}</p>}
    </div>
  );
}
