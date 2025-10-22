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
                      <button className="action-button download-button" onClick={() => startDownload(f.name)}>
                        ⬇️ Download
                      </button>
                      <button className="action-button cancel-button" onClick={() => cancel(f.name)}>
                        🗑️ Clear
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
