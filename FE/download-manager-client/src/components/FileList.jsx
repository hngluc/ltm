// src/components/FileList.jsx
import React, { useEffect, useState, useCallback } from "react"; // Thêm useCallback
import { API_BASE } from "../config";
import { useDownloader } from "../hooks/useDownloader";
import ProgressBar from "./ProgressBar";
import "../App.css";

export default function FileList() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const { progress, downloading, startDownload, pause, cancel } = useDownloader();

  // ----- BƯỚC 1: Tách logic fetch ra hàm riêng -----
  const fetchFiles = useCallback(async () => {
    // Không set loading = true nếu không phải lần đầu
    // setLoading(true); 
    try {
      const res = await fetch(`${API_BASE || ""}/files`);
      const data = await res.json();
      setFiles(data || []);
    } catch (e) {
      console.error("Fetch files failed:", e);
      setFiles([]);
    } finally {
      setLoading(false); // Chỉ set false ở đây
    }
  }, []); // useCallback để hàm này không bị tạo lại mỗi lần render

  // ----- BƯỚC 2: Gọi hàm fetchFiles ở lần đầu tiên -----
  useEffect(() => {
    setLoading(true); // Set loading cho lần đầu
    fetchFiles();
  }, [fetchFiles]);

  // ----- BƯỚC 3: Lắng nghe sự kiện SSE để tự động cập nhật list -----
  useEffect(() => {
    console.log("Connecting to real-time file list updates...");
    const es = new EventSource(`${API_BASE || ""}/files/events/subscribe`);

    // Khi máy chủ gửi sự kiện "list-changed"
    es.addEventListener("list-changed", (event) => {
      console.log("File list changed on server, refreshing...", event.data);
      // Gọi lại hàm fetchFiles để làm mới danh sách
      fetchFiles();
    });

    es.onerror = () => {
      console.error("SSE connection error for file list.");
      // EventSource sẽ tự động cố gắng kết nối lại
    };

    // Dọn dẹp khi component unmount
    return () => {
      console.log("Closing real-time file list connection.");
      es.close();
    };
  }, [fetchFiles]); // Phụ thuộc vào fetchFiles

  // ----- (Các hàm cũ) -----
  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 B";
    if (!bytes && bytes !== 0) return "-";
    const k = 1024, units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
  };

  const handleDelete = async (fileName) => {
    if (!window.confirm(`Bạn có chắc muốn xóa file: ${fileName}?`)) return;
    try {
      const res = await fetch(`${API_BASE || ""}/files/${fileName}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Lỗi khi xóa file.");
      }
      // KHÔNG CẦN CẬP NHẬT UI THỦ CÔNG NỮA
      // setFiles(files.filter((f) => f.name !== fileName));
      // Server sẽ tự động broadcast "list-changed" và useEffect trên sẽ chạy
    } catch (e) {
      console.error("Delete file failed:", e);
      alert(`Xóa file thất bại: ${e.message}`);
    }
  };

  const handleRename = async (oldName) => {
    const newName = window.prompt("Nhập tên mới cho file:", oldName);
    if (!newName || newName === oldName) return;
    try {
      const res = await fetch(`${API_BASE || ""}/files/${oldName}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName: newName }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Lỗi khi đổi tên file.");
      }
      // KHÔNG CẦN CẬP NHẬT UI THỦ CÔNG NỮA
      // setFiles(files.map(f => f.name === oldName ? { ...f, name: newName } : f));
      // Server sẽ tự động broadcast "list-changed"
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
                
                {/* === (KHUYẾN NGHỊ) CẬP NHẬT LOGIC NÚT RESUME === */}
                <td className="cell-action">
                  {!isDownloading ? (
                    <>
                      {/* 1. Logic Resume/Download */}
                      {pct > 0 && pct < 100 ? (
                        <button className="action-button resume-button" onClick={() => startDownload(f.name)}>
                          ▶️ Resume
                        </button>
                      ) : (
                        <button className="action-button download-button" onClick={() => startDownload(f.name)}>
                          ⬇️ Download
                        </button>
                      )}
                      
                      {/* 2. Nút Clear chỉ hiện khi có tiến trình dở */}
                      {pct > 0 && pct < 100 && (
                        <button className="action-button cancel-button" onClick={() => cancel(f.name)}>
                          🗑️ Clear
                        </button>
                      )}

                      {/* 3. Nút Rename/Delete */}
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