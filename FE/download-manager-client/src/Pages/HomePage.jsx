// src/Pages/HomePage.jsx
import React, { useEffect, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { API_BASE } from "../config"; // Sửa lại đường dẫn nếu config.js ở chỗ khác
import { useDownloader } from "../hooks/useDownloader"; // Sửa lại đường dẫn nếu useDownloader.js ở chỗ khác
import ProgressBar from "../components/ProgressBar"; // Sửa lại đường dẫn nếu ProgressBar.jsx ở chỗ khác
import "../App.css"; // Đảm bảo App.css chứa các class button cần thiết

// Sử dụng forwardRef để nhận ref từ App.js
const HomePage = forwardRef((props, ref) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const { progress, downloading, startDownload, pause, cancel } = useDownloader();

  // Tách hàm fetch ra riêng để có thể gọi lại
  const fetchFiles = useCallback(async () => {
    try {
      // Dùng fetch thông thường vì đây là API public
      const res = await fetch(`${API_BASE || ""}/files`); 
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      setFiles(data || []);
    } catch (e) {
      console.error("Fetch files failed:", e);
      setFiles([]); // Đặt lại files thành rỗng nếu lỗi
    } finally {
      setLoading(false);
    }
  }, []); // Dependencies rỗng vì API_BASE không đổi

  // Cung cấp hàm 'refresh' ra bên ngoài thông qua 'ref'
  useImperativeHandle(ref, () => ({
    refresh: () => {
      console.log("Refreshing file list from parent component...");
      fetchFiles(); // Gọi lại hàm fetch
    }
  }));

  // Gọi hàm fetchFiles ở lần đầu tiên component mount
  useEffect(() => {
    setLoading(true); // Báo loading cho lần tải đầu
    fetchFiles();
  }, [fetchFiles]); // Phụ thuộc vào fetchFiles

  // Lắng nghe sự kiện SSE để tự động cập nhật list
  useEffect(() => {
    console.log("Connecting to real-time file list updates...");
    const es = new EventSource(`${API_BASE || ""}/files/events/subscribe`);

    es.addEventListener("list-changed", (event) => {
      console.log("File list changed on server, refreshing...", event.data);
      // Gọi lại hàm fetchFiles để làm mới danh sách
      fetchFiles();
    });

    es.onerror = (e) => {
      console.error("SSE connection error for file list.", e);
      // EventSource sẽ tự động cố gắng kết nối lại, không cần làm gì thêm
      // Có thể đóng kết nối cũ nếu cần es.close();
    };

    // Cleanup function: Đóng kết nối SSE khi component unmount
    return () => {
      console.log("Closing real-time file list connection.");
      es.close();
    };
  }, [fetchFiles]); // Phụ thuộc vào fetchFiles

  // Hàm định dạng kích thước file
  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 B";
    if (!bytes || bytes < 0) return "-"; // Xử lý cả trường hợp âm hoặc null/undefined
    const k = 1024;
    const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]; // Thêm đơn vị lớn hơn
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    // Đảm bảo i nằm trong khoảng index của units
    const unitIndex = Math.min(i, units.length - 1); 
    // Sử dụng toFixed(2) và parseFloat để bỏ số 0 thừa
    return `${parseFloat((bytes / Math.pow(k, unitIndex)).toFixed(2))} ${units[unitIndex]}`;
  };

  // ---- XÓA BỎ HOÀN TOÀN HÀM handleDelete và handleRename ----

  // Render phần loading hoặc khi không có file
  if (loading) return <p className="file-list-status">Đang tải danh sách file...</p>;
  if (!Array.isArray(files) || files.length === 0) return <p className="file-list-status">Không có file nào trong thư mục shared.</p>;

  // Render bảng danh sách file
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
            // Đảm bảo f.name tồn tại trước khi dùng làm key/progress index
            if (!f || typeof f.name !== 'string') return null; 
            
            const pct = Math.round(progress[f.name] ?? 0);
            const isDownloading = !!downloading[f.name];
            
            return (
              <tr key={f.name}>
                <td className="cell-name">{f.name}</td>
                <td className="cell-size">{formatBytes(f.size)}</td>
                <td className="cell-date">
                  {/* Kiểm tra f.lastModified trước khi tạo Date */}
                  {f.lastModified ? new Date(f.lastModified).toLocaleString() : '-'}
                </td>
                <td className="cell-progress">
                  <ProgressBar value={pct} />
                  <span className="progress-text">{pct}%</span>
                </td>
                
                {/* Chỉ hiển thị nút Download/Resume/Clear/Pause/Cancel */}
                <td className="cell-action">
                  {!isDownloading ? (
                    <>
                      {/* Logic Resume/Download */}
                      {pct > 0 && pct < 100 ? (
                        <button className="action-button resume-button" onClick={() => startDownload(f.name)}>
                          ▶️ Resume
                        </button>
                      ) : (
                        <button className="action-button download-button" onClick={() => startDownload(f.name)}>
                          ⬇️ Download
                        </button>
                      )}
                      
                      {/* Nút Clear chỉ hiện khi có tiến trình dở */}
                      {pct > 0 && pct < 100 && (
                        <button className="action-button cancel-button" onClick={() => cancel(f.name)}>
                          🗑️ Clear
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Logic Pause/Cancel khi đang tải */}
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
}); // Kết thúc forwardRef

export default HomePage; // Export component

