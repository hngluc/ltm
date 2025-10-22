// ===== File: src/pages/UploadPage.jsx
import React, { useCallback, useRef, useState } from "react";
import axios from "axios";
import ProgressBar from "../components/ProgressBar";
import { useNavigate } from "react-router-dom";
import "./upload.css"; // styles below

const API_UPLOAD = "/files/upload";

export default function UploadPage() {
  const [queue, setQueue] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const mapped = files.map((f) => ({
      file: f,
      progress: 0,
      status: "queued", // internal status values: queued | uploading | done | error
      error: null,
    }));
    setQueue((prev) => [...prev, ...mapped]);
  }, []);

  const onPick = (e) => addFiles(e.target.files);

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const removeItem = (idx) => {
    setQueue((q) => q.filter((_, i) => i !== idx));
  };

  const clearFinished = () => {
    setQueue((q) => q.filter((x) => x.status !== "done"));
  };

  const clearAll = () => setQueue([]);

  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes)) return "";
    const units = ["B", "KB", "MB", "GB"]; let i = 0; let v = bytes;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
  };

  const uploadOne = async (index) => {
    const item = queue[index];
    if (!item || item.status !== "queued") return;

    setQueue((q) => q.map((x, i) => (i === index ? { ...x, status: "uploading", error: null } : x)));

    const form = new FormData();
    form.append("files", item.file);

    try {
      await axios.post(API_UPLOAD, form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          const total = e.total || item.file.size || 0;
          const pct = total ? Math.round((e.loaded * 100) / total) : 0;
          setQueue((q) => q.map((x, i) => (i === index ? { ...x, progress: Math.min(100, pct) } : x)));
        },
      });

      setQueue((q) => q.map((x, i) => (i === index ? { ...x, status: "done", progress: 100 } : x)));
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Upload thất bại";
      setQueue((q) => q.map((x, i) => (i === index ? { ...x, status: "error", error: message } : x)));
    }
  };

  const uploadAll = async () => {
    if (isUploading) return;
    setIsUploading(true);
    const tasks = [];
    // upload everything currently queued, in parallel
    queue.forEach((item, i) => {
      if (item.status === "queued") tasks.push(uploadOne(i));
    });
    await Promise.allSettled(tasks);
    setIsUploading(false);
  };

  const doneAndBack = () => navigate("/");

  const statusBadge = (s) => {
    const map = {
      queued: { label: "Đợi upload", cls: "badge soft" },
      uploading: { label: "Đang tải lên", cls: "badge info" },
      done: { label: "Hoàn tất", cls: "badge success" },
      error: { label: "Lỗi", cls: "badge danger" },
    };
    const it = map[s] || { label: s, cls: "badge" };
    return <span className={it.cls}>{it.label}</span>;
  };

  return (
    <div className="upload-page">
      <div className="header">
        <div>
          <h2>⬆️ Upload Files</h2>
          <p className="muted">Chọn hoặc kéo thả các file cần tải lên.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => inputRef.current?.click()}>
            Chọn file
          </button>
          <button className="btn primary" onClick={uploadAll} disabled={!queue.some(x=>x.status==='queued') || isUploading}>
            {isUploading ? "Đang upload..." : "Upload tất cả"}
          </button>
          <button className="btn ghost" onClick={doneAndBack}>← Quay lại</button>
        </div>
      </div>

      <input type="file" multiple hidden ref={inputRef} onChange={onPick} />

      <div
        className={`dropzone ${isDragging ? "dragging" : ""}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDragEnd={() => setIsDragging(false)}
      >
        <div className="dz-icon">📁</div>
        <div className="dz-text">
          <strong>Kéo & thả</strong> file vào đây hoặc <u>bấm để chọn</u>
        </div>
        <button className="btn tiny" type="button" onClick={() => inputRef.current?.click()}>Chọn file</button>
      </div>

      {queue.length === 0 ? (
        <p className="empty">Chưa chọn file nào.</p>
      ) : (
        <div className="table-wrap">
          <table className="file-table">
            <thead>
              <tr>
                <th>Tên file</th>
                <th>Kích thước</th>
                <th>Tiến trình</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item, i) => (
                <tr key={i}>
                  <td>
                    <div className="filecell">
                      <span className="fileicon">📄</span>
                      <div className="filename" title={item.file.name}>{item.file.name}</div>
                    </div>
                  </td>
                  <td className="size">{formatBytes(item.file.size)}</td>
                  <td className="progress">
                    <ProgressBar value={item.progress} />
                    <span className="pct">{item.progress}%</span>
                  </td>
                  <td>
                    {statusBadge(item.status)}
                    {item.status === "error" && (
                      <div className="err">{item.error}</div>
                    )}
                  </td>
                  <td className="row-actions">
                    {item.status === "queued" && (
                      <button className="btn tiny" onClick={() => uploadOne(i)}>Upload</button>
                    )}
                    <button className="btn tiny danger" onClick={() => removeItem(i)}>Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {queue.length > 0 && (
        <div className="footer-actions">
          <button className="btn ghost" onClick={clearFinished} disabled={!queue.some(x=>x.status==='done')}>Xóa mục đã hoàn tất</button>
          <button className="btn ghost" onClick={clearAll}>Xóa tất cả</button>
        </div>
      )}
    </div>
  );
}


