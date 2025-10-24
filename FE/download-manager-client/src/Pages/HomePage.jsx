import React, { useEffect, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { isAdminFromToken } from "../utils/auth";
import { API_BASE } from "../config";
import { useDownloader } from "../hooks/useDownloader";
import ProgressBar from "../components/ProgressBar";
import "../App.css";

const HomePage = forwardRef((props, ref) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = isAdminFromToken();
  const { progress, downloading, startDownload, pause, cancel } = useDownloader();

  // --- Fetch danh sách file ---
  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE || ""}/files`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setFiles(data || []);
    } catch (e) {
      console.error("Fetch files failed:", e);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Refresher từ App.js ---
  useImperativeHandle(ref, () => ({
    refresh: () => {
      console.log("Refreshing file list from parent component...");
      fetchFiles();
    },
  }));

  // --- Gọi API lần đầu ---
  useEffect(() => {
    setLoading(true);
    fetchFiles();
  }, [fetchFiles]);

  // --- Lắng nghe SSE cập nhật realtime ---
  useEffect(() => {
    console.log("Connecting to real-time file list updates...");
    const es = new EventSource(`${API_BASE || ""}/files/events/subscribe`);

    es.addEventListener("list-changed", (event) => {
      console.log("File list changed, refreshing...", event.data);
      fetchFiles();
    });

    es.onerror = (e) => console.error("SSE error for file list:", e);

    return () => {
      console.log("Closing real-time file list connection.");
      es.close();
    };
  }, [fetchFiles]);

  // --- Định dạng kích thước ---
  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 B";
    if (!bytes || bytes < 0) return "-";
    const k = 1024;
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
  };

  // --- Xoá file (ADMIN) ---
  const handleDelete = async (name) => {
    if (!window.confirm(`Bạn có chắc muốn xoá file "${name}"?`)) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/files/${encodeURIComponent(name)}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      console.log(`File ${name} deleted`);
      fetchFiles(); // cập nhật lại danh sách
    } catch (err) {
      console.error("Delete error:", err);
      alert(`❌ Xoá lỗi: ${err.message}`);
    }
  };

  // --- Render ---
  if (loading)
    return <p className="file-list-status">Đang tải danh sách file...</p>;
  if (!Array.isArray(files) || files.length === 0)
    return <p className="file-list-status">Không có file nào trong thư mục shared.</p>;

  return (
    <div className="file-list-container">
      <h2>📁 Danh sách File Shared (Công khai)</h2>
      <table className="file-table">
        <thead>
          <tr>
            <th className="th-name">Tên File</th>
            <th className="th-size">Kích thước</th>
            <th className="th-date">Cập nhật</th>
            <th className="th-progress">Tiến trình Tải</th>
            <th className="th-action">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => {
            if (!f || typeof f.name !== "string") return null;
            const pct = Math.round(progress[f.name] ?? 0);
            const isDownloading = !!downloading[f.name];

            return (
              <tr key={f.name}>
                <td className="cell-name">{f.name}</td>
                <td className="cell-size">{formatBytes(f.size)}</td>
                <td className="cell-date">
                  {f.lastModified ? new Date(f.lastModified).toLocaleString() : "-"}
                </td>
                <td className="cell-progress">
                  <ProgressBar value={pct} />
                  <span className="progress-text">{pct}%</span>
                </td>
                <td className="cell-action">
                  {!isDownloading ? (
                    <>
                      {pct > 0 && pct < 100 ? (
                        <button
                          className="action-button resume-button"
                          onClick={() => startDownload(f.name)}
                        >
                          ▶️ Resume
                        </button>
                      ) : (
                        <button
                          className="action-button download-button"
                          onClick={() => startDownload(f.name)}
                        >
                          ⬇️ Download
                        </button>
                      )}
                      {pct > 0 && pct < 100 && (
                        <button
                          className="action-button cancel-button"
                          onClick={() => cancel(f.name)}
                        >
                          🗑️ Clear
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        className="action-button pause-button"
                        onClick={() => pause(f.name)}
                      >
                        ⏸ Pause
                      </button>
                      <button
                        className="action-button cancel-button"
                        onClick={() => cancel(f.name)}
                      >
                        ✖️ Cancel
                      </button>
                    </>
                  )}

                  {/* 🗑️ Nút Delete cho ADMIN */}
                  {isAdmin && (
                    <button
                      className="action-button cancel-button"
                      style={{ marginLeft: 8 }}
                      onClick={() => handleDelete(f.name)}
                      title="Xoá file (ADMIN)"
                    >
                      🗑️ Delete
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

export default HomePage;
