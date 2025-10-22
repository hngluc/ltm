// src/components/FileList.jsx
import React, { useEffect, useState } from "react";
import { API_BASE } from "../config";
import { useDownloader } from "../hooks/useDownloader";
import ProgressBar from "./ProgressBar";
import "../App.css";

export default function FileList() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const { progress, downloading, startDownload, pause, cancel } = useDownloader();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE || ""}/files`);
        const data = await res.json();
        setFiles(data || []);
      } catch (e) {
        console.error("Fetch files failed:", e);
        setFiles([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 B";
    if (!bytes && bytes !== 0) return "-";
    const k = 1024, units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
  };

  const handleDelete = async (fileName) => {
    // Xác nhận trước khi xóa
    if (!window.confirm(`Bạn có chắc muốn xóa file: ${fileName}?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE || ""}/files/${fileName}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Lỗi khi xóa file.");
      }
      
      console.log(`File ${fileName} đã được xóa.`);
      // Cập nhật lại danh sách file trên UI
      setFiles(files.filter((f) => f.name !== fileName));

    } catch (e) {
      console.error("Delete file failed:", e);
      alert(`Xóa file thất bại: ${e.message}`);
    }
  };

  const handleRename = async (oldName) => {
    const newName = window.prompt("Nhập tên mới cho file:", oldName);

    // Nếu người dùng hủy hoặc không nhập gì
    if (!newName || newName === oldName) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE || ""}/files/${oldName}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newName: newName }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Lỗi khi đổi tên file.");
      }
      
      console.log(`Đã đổi tên ${oldName} -> ${newName}`);
      // Cập nhật lại danh sách file trên UI
      setFiles(files.map(f => 
        f.name === oldName ? { ...f, name: newName } : f
      ));

    } catch (e) {
      console.error("Rename file failed:", e);
      alert(`Đổi tên file thất bại: ${e.message}`);
    }
  };

  if (loading) return <p className="file-list-status">Đang tải danh sách file...</p>;
  if (files.length === 0) return <p className="file-list-status">Không có file nào trong thư mục shared.</p>;

  return (
    <div className="file-list-container">
      <h2>📁 Danh sách File Shared</h2>
      <table className="file-table">
        <thead>
          <tr>
            <th className="th-name">Tên File</th>
            <th className="th-size">Kích thước</th>
            <th className="th-date">Cập nhật</th>
            <th className="th-progress">Tiến trình</th>
            <th className="th-action">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => {
            const pct = Math.round(progress[f.name] ?? 0);
            const isDownloading = !!downloading[f.name];
            return (
              <tr key={f.name}>
                <td className="cell-name">{f.name}</td>
                <td className="cell-size">{formatBytes(f.size)}</td>
                <td className="cell-date">{new Date(f.lastModified).toLocaleString()}</td>
                <td className="cell-progress">
                  <ProgressBar value={pct} />
                  <span className="progress-text">{pct}%</span>
                </td>
                <td className="cell-action">
                  {!isDownloading ? (
                    <>
                      {/* === LOGIC RESUME BẮT ĐẦU === */}
                      {pct > 0 && pct < 100 ? (
                        // 1. Đã có tiến trình -> Nút "Resume"
                        <button className="action-button resume-button" onClick={() => startDownload(f.name)}>
                          ▶️ Resume
                        </button>
                      ) : (
                        // 2. Chưa có gì -> Nút "Download"
                        <button className="action-button download-button" onClick={() => startDownload(f.name)}>
                          ⬇️ Download
                        </button>
                      )}
                      
                      {/* Nút "Clear" chỉ hiển thị khi có tiến trình dở dang */}
                      {pct > 0 && pct < 100 && (
                        <button className="action-button cancel-button" onClick={() => cancel(f.name)}>
                          🗑️ Clear
                        </button>
                      )}
                      {/* === LOGIC RESUME KẾT THÚC === */}

                      {/* Nút Rename và Delete giữ nguyên */}
                      <button className="action-button rename-button" onClick={() => handleRename(f.name)}>
                        ✏️ Rename
                      </button>
                      <button className="action-button delete-button" onClick={() => handleDelete(f.name)}>
                        🗑️ Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="action-button pause-button" onClick={() => pause(f.name)}>
                        ⏸ Pause
                      </button>
                      <button className="action-button cancel-button" onClick={() => cancel(f.name)}>
                        ✖️ Cancel
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
