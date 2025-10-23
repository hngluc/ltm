// src/Pages/UploadPage.jsx
import React, { useRef, useState } from "react";
import { API_BASE } from "../config";
import "./upload.css";

export default function UploadPage() {
  const [files, setFiles] = useState([]);        // danh sách file đã chọn
  const [busy, setBusy]   = useState(false);     // trạng thái đang upload
  const [message, setMsg] = useState(null);      // { type: 'success' | 'error' | 'info', text: string }
  const inputRef = useRef(null);

  const formatBytes = (bytes) => {
    if (!bytes && bytes !== 0) return "-";
    const k = 1024;
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(Math.floor(Math.log(Math.max(bytes,1)) / Math.log(k)), units.length - 1);
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
  };

  const onPick = (e) => {
    const list = Array.from(e.target.files || []);
    setFiles(list);
    setMsg(list.length ? { type: "info", text: `${list.length} file được chọn` } : null);
  };

  const clearSelection = () => {
    setFiles([]);
    inputRef.current && (inputRef.current.value = "");
    setMsg(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!files.length || busy) return;

    try {
      setBusy(true);
      setMsg({ type: "info", text: "Đang upload…" });

      const form = new FormData();
      files.forEach((f) => form.append("files", f)); // ✅ khớp @RequestPart("files")

      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/files/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form, // KHÔNG set Content-Type khi dùng FormData
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || "Upload failed"}`);
      }

      setMsg({ type: "success", text: "✅ Upload thành công" });
      clearSelection(); // reset input
      // Danh sách sẽ tự cập nhật nếu bạn dùng SSE file-list; không thì có thể gọi API refresh tại đây
    } catch (err) {
      console.error("Upload error:", err);
      const text = String(err).includes("TypeError: Failed to fetch")
        ? "❌ Không kết nối được server (API_BASE/CORS/port)."
        : `❌ Upload lỗi: ${err.message}`;
      setMsg({ type: "error", text });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel" style={{ padding: 20 }}>
      <h2 style={{ marginBottom: 12 }}>⬆️ Upload file</h2>

      <form onSubmit={handleSubmit} className="form-grid" style={{ gap: 12 }}>
        <label htmlFor="picker" style={{ fontWeight: 600 }}>Chọn file</label>
        <input
          id="picker"
          ref={inputRef}
          type="file"
          multiple
          onChange={onPick}
          disabled={busy}
        />

        {files.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 6, opacity: 0.9 }}>
              Danh sách ({files.length}):
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {files.map((f) => (
                <li key={f.name}>
                  <b>{f.name}</b> — {formatBytes(f.size)}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="submit" disabled={!files.length || busy}>
            {busy ? "Đang gửi…" : "Upload"}
          </button>
          <button type="button" onClick={clearSelection} disabled={!files.length || busy}>
            Xoá chọn
          </button>
        </div>
      </form>

      {message && (
        <p
          className="status"
          style={{
            marginTop: 12,
            color:
              message.type === "success" ? "#22c55e" :
              message.type === "error"   ? "#ef4444" :
              "#cbd5e1"
          }}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
