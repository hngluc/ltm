import React, { useEffect, useState, useRef } from "react";
import "../App.css";

const API_BASE = "http://localhost:8080";
const DB_NAME = "download_db_v1";
const STORE_NAME = "file_parts";
const CHUNK_STORE_META = "file_meta";
const MAX_RETRIES = 5;

// --- IndexedDB helper functions (giữ nguyên) ---
function openDb() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "file" });
      }
      if (!db.objectStoreNames.contains(CHUNK_STORE_META)) {
        db.createObjectStore(CHUNK_STORE_META, { keyPath: "file" });
      }
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function savePart(file, partBlob) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(file);
    getReq.onsuccess = () => {
      const existing = getReq.result || { file, parts: [] };
      existing.parts.push(partBlob);
      const putReq = store.put(existing);
      putReq.onsuccess = () => res(true);
      putReq.onerror = () => rej(putReq.error);
    };
    getReq.onerror = () => rej(getReq.error);
  });
}

async function getParts(file) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(file);
    req.onsuccess = () => {
      const val = req.result;
      res(val ? val.parts : []);
    };
    req.onerror = () => rej(req.error);
  });
}

async function clearParts(file) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(file);
    req.onsuccess = () => res(true);
    req.onerror = () => rej(req.error);
  });
}

async function saveMeta(file, meta) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(CHUNK_STORE_META, "readwrite");
    const store = tx.objectStore(CHUNK_STORE_META);
    const putReq = store.put({ file, ...meta });
    putReq.onsuccess = () => res(true);
    putReq.onerror = () => rej(putReq.error);
  });
}

async function getMeta(file) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(CHUNK_STORE_META, "readonly");
    const store = tx.objectStore(CHUNK_STORE_META);
    const req = store.get(file);
    req.onsuccess = () => res(req.result || null);
    req.onerror = () => rej(req.error);
  });
}

async function clearMeta(file) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(CHUNK_STORE_META, "readwrite");
    const store = tx.objectStore(CHUNK_STORE_META);
    const req = store.delete(file);
    req.onsuccess = () => res(true);
    req.onerror = () => rej(req.error);
  });
}

// --- ProgressBar Component ---
function ProgressBar({ value = 0, downloadedBytes = 0, totalBytes = 0, speed = 0, timeRemaining = 0 }) {
  const pct = Math.min(100, Math.max(0, value || 0));
  
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSecond) => {
    if (!bytesPerSecond || bytesPerSecond === 0) return "";
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  const formatTime = (seconds) => {
    if (seconds <= 0) return "";
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  return (
    <div className="progress-container">
      <div className="progress-bar-container">
        <div 
          className="progress-bar-fill" 
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="progress-details">
        <span className="progress-percent">{pct.toFixed(1)}%</span>
        <span className="progress-size">
          ({formatBytes(downloadedBytes)} / {formatBytes(totalBytes)})
        </span>
        {speed > 0 && (
          <span className="progress-speed">{formatSpeed(speed)}</span>
        )}
        {timeRemaining > 0 && (
          <span className="progress-time">⏱️ {formatTime(timeRemaining)}</span>
        )}
      </div>
    </div>
  );
}

// --- Realistic Download Simulator (NHƯ TẢI TỪ GOOGLE) ---
class RealisticDownloadSimulator {
  constructor(totalSize, fileName) {
    this.totalSize = totalSize;
    this.fileName = fileName;
    this.startTime = Date.now();
    this.currentProgress = 0;
    this.isComplete = false;
    this.actualDownloaded = 0;
    this.lastUpdateTime = this.startTime;
    this.speed = 0;
    
    // TỐC ĐỘ THẬT NHƯ INTERNET THẬT
    this.setRealisticSpeed();
    
    console.log(`🚀 Bắt đầu tải "${fileName}" - ${this.formatBytes(totalSize)} - Tốc độ mô phỏng: ${this.formatBytes(this.speed)}/s`);
  }

  setRealisticSpeed() {
    const sizeMB = this.totalSize / (1024 * 1024);
    
    // TỐC ĐỘ INTERNET THẬT (giống như tải từ Google Drive)
    if (sizeMB < 1) {
      // File nhỏ: tốc độ chậm vừa
      this.speed = 50 * 1024; // 50 KB/s
    } else if (sizeMB < 10) {
      // File vừa: tốc độ trung bình
      this.speed = 200 * 1024; // 200 KB/s
    } else if (sizeMB < 100) {
      // File lớn: tốc độ nhanh
      this.speed = 500 * 1024; // 500 KB/s
    } else {
      // File rất lớn: tốc độ cao
      this.speed = 1024 * 1024; // 1 MB/s
    }

    // Tính thời gian tải dự kiến
    this.estimatedTime = this.totalSize / this.speed;
    console.log(`⏱️ Thời gian dự kiến: ${this.formatTime(this.estimatedTime)}`);
  }

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  formatTime(seconds) {
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${minutes}m ${secs}s`;
  }

  // Tính toán progress dựa trên thời gian thực
  calculateProgress() {
    if (this.isComplete) {
      return {
        percentage: 100,
        downloaded: this.totalSize,
        speed: 0,
        timeRemaining: 0
      };
    }

    const now = Date.now();
    const elapsed = (now - this.startTime) / 1000; // thời gian đã trôi qua (giây)
    
    // Tính số byte đã tải dựa trên tốc độ và thời gian
    const simulatedDownloaded = Math.min(this.speed * elapsed, this.totalSize);
    
    // Đồng bộ với tiến độ thực tế (không vượt quá)
    const actualDownloaded = Math.min(simulatedDownloaded, this.actualDownloaded);
    
    const percentage = (actualDownloaded / this.totalSize) * 100;
    
    // Tính tốc độ thực tế
    const timeDiff = (now - this.lastUpdateTime) / 1000;
    if (timeDiff > 1) {
      // Cập nhật tốc độ mỗi giây
      const downloadedDiff = actualDownloaded - this.currentDownloaded;
      this.currentSpeed = downloadedDiff / timeDiff;
      this.lastUpdateTime = now;
      this.currentDownloaded = actualDownloaded;
    }

    // Tính thời gian còn lại
    const remainingBytes = this.totalSize - actualDownloaded;
    const timeRemaining = this.currentSpeed > 0 ? remainingBytes / this.currentSpeed : remainingBytes / this.speed;

    this.currentProgress = percentage;

    return {
      percentage: percentage,
      downloaded: actualDownloaded,
      speed: this.currentSpeed || this.speed,
      timeRemaining: timeRemaining
    };
  }

  // Cập nhật tiến độ thực tế từ download thật
  updateActual(downloadedBytes) {
    this.actualDownloaded = downloadedBytes;
    
    // Nếu download thật đã xong, đánh dấu hoàn thành
    if (this.actualDownloaded >= this.totalSize) {
      this.isComplete = true;
    }
  }

  markComplete() {
    this.isComplete = true;
    this.currentProgress = 100;
  }
}

export default function FileList() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({});
  const [downloading, setDownloading] = useState({});
  const [progressDetails, setProgressDetails] = useState({});
  const controllers = useRef({});
  const downloadSimulators = useRef({});
  const animationFrames = useRef({});

  useEffect(() => {
    fetchFiles();
  }, []);

  async function fetchFiles() {
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
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  async function getDownloadedBytes(fileName) {
    const parts = await getParts(fileName);
    let total = 0;
    for (const p of parts) total += p.size || (p.byteLength || 0);
    return total;
  }

  // Progress animation - CẬP NHẬT LIÊN TỤC
  const startProgressAnimation = (fileName, totalSize) => {
    const simulator = downloadSimulators.current[fileName];
    if (!simulator) return;

    const animate = () => {
      if (!simulator || !controllers.current[fileName] || controllers.current[fileName].abort) {
        return;
      }

      const progress = simulator.calculateProgress();
      
      setProgress((s) => ({ ...s, [fileName]: progress.percentage }));
      setProgressDetails((s) => ({
        ...s,
        [fileName]: {
          downloaded: progress.downloaded,
          total: totalSize,
          speed: progress.speed,
          timeRemaining: progress.timeRemaining
        }
      }));

      if (progress.percentage < 100 && !simulator.isComplete) {
        // Cập nhật mỗi 100ms để mượt mà
        animationFrames.current[fileName] = setTimeout(animate, 100);
      } else if (progress.percentage >= 100) {
        // Hoàn thành
        simulator.markComplete();
        finalizeDownload(fileName);
      }
    };

    animate();
  };

  // Start download - CHẬM NHƯ THẬT
  const startDownload = async (fileName) => {
    if (downloading[fileName]) return;
    
    setDownloading((s) => ({ ...s, [fileName]: true }));
    setProgress((s) => ({ ...s, [fileName]: 0 }));

    const existingBytes = await getDownloadedBytes(fileName);
    let totalSize = 0;

    // Get file size
    try {
      const headResp = await fetch(`${API_BASE}/files/${encodeURIComponent(fileName)}`, {
        method: 'HEAD'
      });
      if (headResp.ok) {
        const contentLength = headResp.headers.get('Content-Length');
        if (contentLength) {
          totalSize = parseInt(contentLength);
        }
      }
    } catch (err) {
      console.warn('Cannot get file info via HEAD:', err);
    }

    // Fallback to file list size
    if (!totalSize) {
      const fileInfo = files.find(f => f.name === fileName);
      totalSize = fileInfo?.size || 0;
    }

    // Khởi tạo simulator với tốc độ thực tế
    downloadSimulators.current[fileName] = new RealisticDownloadSimulator(totalSize, fileName);
    controllers.current[fileName] = { abort: false, controller: new AbortController() };

    // Bắt đầu animation
    startProgressAnimation(fileName, totalSize);

    // Bắt đầu download THẬT nhưng CHẬM có kiểm soát
    let attempt = 0;
    while (attempt < MAX_RETRIES && !controllers.current[fileName].abort) {
      try {
        await downloadWithControlledSpeed(fileName, totalSize, downloadSimulators.current[fileName]);
        break;
      } catch (err) {
        attempt++;
        console.warn(`Download ${fileName} failed attempt ${attempt}`, err);
        if (attempt >= MAX_RETRIES) {
          if (animationFrames.current[fileName]) {
            clearTimeout(animationFrames.current[fileName]);
          }
          alert(`Tải thất bại: ${fileName}`);
          setDownloading((s) => ({ ...s, [fileName]: false }));
          return;
        }
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  };

  // Download với tốc độ được kiểm soát - CHẬM NHƯ INTERNET THẬT
  async function downloadWithControlledSpeed(fileName, totalSize, simulator) {
    let downloaded = await getDownloadedBytes(fileName);

    const startByte = downloaded;
    const headers = {};
    if (startByte > 0) headers['Range'] = `bytes=${startByte}-`;

    const controller = controllers.current[fileName].controller;
    const response = await fetch(`${API_BASE}/files/${encodeURIComponent(fileName)}`, {
      method: 'GET',
      headers,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    let chunkCount = 0;

    try {
      while (!controllers.current[fileName].abort) {
        const { done, value } = await reader.read();
        if (done) break;

        chunkCount++;
        
        // THÊM DELAY ĐỂ GIẢ LẬP TỐC ĐỘ INTERNET THẬT
        const chunkSize = value.byteLength;
        const simulatedTime = chunkSize / simulator.speed; // thời gian nên mất để tải chunk này
        const actualTime = Math.max(simulatedTime * 1000, 100); // ít nhất 100ms mỗi chunk
        
        await new Promise(resolve => setTimeout(resolve, actualTime));

        // Save chunk
        const blob = new Blob([value], { type: "application/octet-stream" });
        await savePart(fileName, blob);

        // Cập nhật tiến độ thực
        downloaded += chunkSize;
        simulator.updateActual(downloaded);

        console.log(`📦 Chunk ${chunkCount}: ${simulator.formatBytes(downloaded)}/${simulator.formatBytes(totalSize)} (${((downloaded/totalSize)*100).toFixed(1)}%)`);
      }
    } finally {
      try { reader.releaseLock(); } catch(e) {}
    }

    if (controllers.current[fileName].abort) {
      return;
    }

    // Đánh dấu hoàn thành
    simulator.markComplete();
  }

  // Finalize download
  async function finalizeDownload(fileName) {
    const parts = await getParts(fileName);
    if (!parts || parts.length === 0) return;
    
    // Thêm delay cuối cùng để chắc chắn progress chạy đủ
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const finalBlob = new Blob(parts, { type: "application/octet-stream" });
    const url = URL.createObjectURL(finalBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    // Cleanup
    await clearParts(fileName);
    await clearMeta(fileName);

    // Dọn dẹp
    if (animationFrames.current[fileName]) {
      clearTimeout(animationFrames.current[fileName]);
      delete animationFrames.current[fileName];
    }

    setDownloading((s) => ({ ...s, [fileName]: false }));
    delete downloadSimulators.current[fileName];
    
    console.log(`✅ Download hoàn thành: ${fileName}`);
  }

  // Pause download
  function pauseDownload(fileName) {
    if (!controllers.current[fileName]) return;
    controllers.current[fileName].abort = true;
    try {
      controllers.current[fileName].controller.abort();
    } catch (e) {}
    
    if (animationFrames.current[fileName]) {
      clearTimeout(animationFrames.current[fileName]);
    }
    
    setDownloading((s) => ({ ...s, [fileName]: false }));
  }

  // Cancel download
  async function cancelDownload(fileName) {
    if (controllers.current[fileName]) {
      controllers.current[fileName].abort = true;
      try { 
        controllers.current[fileName].controller.abort(); 
      } catch(e) {}
    }
    
    if (animationFrames.current[fileName]) {
      clearTimeout(animationFrames.current[fileName]);
      delete animationFrames.current[fileName];
    }
    
    await clearParts(fileName);
    await clearMeta(fileName);
    
    setProgress((s) => ({ ...s, [fileName]: 0 }));
    setDownloading((s) => ({ ...s, [fileName]: false }));
    setProgressDetails((s) => ({ ...s, [fileName]: null }));
    
    delete downloadSimulators.current[fileName];
  }

  // UI render
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
                        onClick={() => startDownload(f.name)}
                      >
                        ⬇️ Download
                      </button>
                      <button 
                        className="action-button resume-button" 
                        onClick={() => startDownload(f.name)}
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
}