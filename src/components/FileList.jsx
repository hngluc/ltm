// components/FileList.jsx
import React, { useEffect, useState } from 'react';
import { useDownloader } from '../hooks/useDownloader';
import ProgressBar from './ProgressBar';

const API_BASE = "http://localhost:8080";

const FileList = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const {
    progress,
    downloading,
    progressDetails,
    startDownload,
    pauseDownload,
    cancelDownload,
    formatBytes
  } = useDownloader();

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API_BASE}/files`);
      const arr = await res.json();
      setFiles(arr);
    } catch (err) {
      console.error("Fail list files", err);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDownload = async (fileName, fileSize) => {
    await startDownload(fileName, fileSize);
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
            const details = progressDetails[f.name] || {};
            const isDownloading = downloading[f.name];
            
            return (
              <tr key={f.name}>
                <td className="cell-name">{f.name}</td>
                <td className="cell-size">{formatBytes(f.size)}</td>
                <td className="cell-date">{new Date(f.lastModified).toLocaleString()}</td>
                <td className="cell-progress">
                  <ProgressBar 
                    value={progress[f.name] || 0}
                    downloadedBytes={details.downloaded || 0}
                    totalBytes={details.total || f.size}
                    speed={details.speed || 0}
                    timeRemaining={details.timeRemaining || 0}
                  />
                </td>
                <td className="cell-action">
                  {!isDownloading ? (
                    <>
                      <button 
                        className="action-button download-button" 
                        onClick={() => handleStartDownload(f.name, f.size)}
                      >
                        ⬇️ Download
                      </button>
                      <button 
                        className="action-button resume-button" 
                        onClick={() => handleStartDownload(f.name, f.size)}
                      >
                        ↻ Resume
                      </button>
                      <button 
                        className="action-button cancel-button" 
                        onClick={() => cancelDownload(f.name)}
                      >
                        🗑️ Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        className="action-button pause-button" 
                        onClick={() => pauseDownload(f.name)}
                      >
                        ⏸ Pause
                      </button>
                      <button 
                        className="action-button cancel-button" 
                        onClick={() => cancelDownload(f.name)}
                      >
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
};

export default FileList;