// src/hooks/useDownloader.js
import { useEffect, useRef, useState } from "react";
import { API_BASE, MAX_RETRIES } from "../config";
import {
  openDb, getMeta, getParts, savePart, clearMeta, clearParts,
} from "../utils/idb";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Download Simulator đơn giản
class DownloadSimulator {
  constructor(totalSize, fileName) {
    this.totalSize = totalSize;
    this.fileName = fileName;
    this.startTime = Date.now();
    this.currentProgress = 0;
    this.isComplete = false;
    this.actualDownloaded = 0;
    
    this.setRealisticTiming();
  }

  setRealisticTiming() {
    const sizeMB = this.totalSize / (1024 * 1024);
    
    if (this.totalSize < 1024) {
      this.totalDuration = 8000;
    } else if (this.totalSize < 1024 * 1024) {
      this.totalDuration = 12000;
    } else if (this.totalSize < 10 * 1024 * 1024) {
      this.totalDuration = 20000;
    } else {
      this.totalDuration = 30000;
    }
  }

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  updateActualDownloaded(downloadedBytes) {
    this.actualDownloaded = downloadedBytes;
    
    if (this.totalSize > 0 && downloadedBytes >= this.totalSize * 0.995) {
      this.isComplete = true;
      this.currentProgress = 100;
    }
  }

  calculateProgress() {
    if (this.isComplete) {
      return {
        percentage: 100,
        downloaded: this.totalSize
      };
    }

    const now = Date.now();
    const elapsed = now - this.startTime;
    
    let progressRatio;
    
    if (this.totalSize > 0) {
      const actualRatio = this.actualDownloaded / this.totalSize;
      const timeBasedRatio = Math.min(elapsed / this.totalDuration, 0.99);
      progressRatio = Math.max(actualRatio, timeBasedRatio);
    } else {
      progressRatio = Math.min(elapsed / this.totalDuration, 0.99);
    }
    
    const percentage = Math.min(progressRatio * 100, 99.9);
    const downloaded = this.totalSize > 0 ? Math.floor(this.totalSize * progressRatio) : 0;

    this.currentProgress = percentage;

    if (elapsed >= this.totalDuration && this.actualDownloaded >= this.totalSize * 0.95) {
      this.isComplete = true;
      return {
        percentage: 100,
        downloaded: this.totalSize
      };
    }

    return {
      percentage: percentage,
      downloaded: downloaded
    };
  }

  markComplete() {
    this.isComplete = true;
    this.currentProgress = 100;
  }

  getChunkDelay() {
    if (this.totalSize < 1024 * 1024) {
      return 200;
    } else {
      return 100;
    }
  }
}

export function useDownloader() {
  const [progress, setProgress] = useState({});
  const [downloading, setDownloading] = useState({});
  const [downloadStates, setDownloadStates] = useState({});
  
  const controllers = useRef({});
  const downloadSimulators = useRef({});
  const animationFrames = useRef({});

  const setProgressValue = (fileName, pct) => {
    setProgress(prev => ({ ...prev, [fileName]: Math.min(100, Math.max(0, pct)) }));
  };
  
  const setDownloadingFlag = (fileName, bool) => {
    setDownloading(prev => ({ ...prev, [fileName]: bool }));
  };

  const setDownloadState = (fileName, state) => {
    setDownloadStates(prev => ({ ...prev, [fileName]: state }));
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Progress Animation
  const startProgressAnimation = (fileName, totalSize) => {
    const simulator = downloadSimulators.current[fileName];
    if (!simulator) return;

    const animate = () => {
      if (!simulator || !controllers.current[fileName] || controllers.current[fileName].abort) {
        return;
      }

      const progress = simulator.calculateProgress();
      
      setProgressValue(fileName, progress.percentage);

      const shouldComplete = progress.percentage >= 99.9 || 
                           simulator.isComplete ||
                           (totalSize > 0 && progress.downloaded >= totalSize * 0.995);

      if (!shouldComplete) {
        animationFrames.current[fileName] = requestAnimationFrame(animate);
      } else {
        simulator.markComplete();
        setProgressValue(fileName, 100);
        setDownloadState(fileName, 'completed');
        finalizeDownload(fileName);
      }
    };

    animate();
  };

  // Download thực tế
  async function downloadWithControlledSpeed(fileName, totalSize) {
    const existingBytes = await getDownloadedBytes(fileName);
    let downloaded = existingBytes;

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

    try {
      while (!controllers.current[fileName].abort) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkDelay = downloadSimulators.current[fileName].getChunkDelay();
        await sleep(chunkDelay);

        const blob = new Blob([value], { type: "application/octet-stream" });
        await savePart(fileName, blob);

        downloaded += value.byteLength;

        const simulator = downloadSimulators.current[fileName];
        if (simulator) {
          simulator.updateActualDownloaded(downloaded);
        }

        if (totalSize > 0 && downloaded >= totalSize * 0.995) {
          break;
        }
      }
    } finally {
      try { 
        if (reader.releaseLock) reader.releaseLock(); 
      } catch(e) {}
    }

    if (controllers.current[fileName].abort) {
      return;
    }

    const simulator = downloadSimulators.current[fileName];
    if (simulator && totalSize > 0 && downloaded >= totalSize * 0.95) {
      simulator.isComplete = true;
    }
  }

  async function getDownloadedBytes(fileName) {
    try {
      const parts = await getParts(fileName);
      return parts.reduce((sum, p) => sum + (p.size || p.byteLength || 0), 0);
    } catch {
      return 0;
    }
  }

  async function finalizeDownload(fileName) {
    try {
      await sleep(500);
      
      const parts = await getParts(fileName);
      if (!parts || parts.length === 0) return;
      
      const finalBlob = new Blob(parts, { type: "application/octet-stream" });
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      await clearParts(fileName);
      await clearMeta(fileName);

      if (animationFrames.current[fileName]) {
        cancelAnimationFrame(animationFrames.current[fileName]);
        delete animationFrames.current[fileName];
      }

      setDownloadingFlag(fileName, false);
      delete downloadSimulators.current[fileName];
      
    } catch (err) {
      console.error("Finalize error:", err);
      setDownloadState(fileName, 'error');
      setDownloadingFlag(fileName, false);
    }
  }

  // Public API
  async function startDownload(fileName, fileSize = 0) {
    if (downloading[fileName]) {
      return;
    }

    setDownloadingFlag(fileName, true);
    setProgressValue(fileName, 0);
    setDownloadState(fileName, 'active');

    let totalSize = fileSize;

    if (!totalSize) {
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
    }

    downloadSimulators.current[fileName] = new DownloadSimulator(totalSize, fileName);
    controllers.current[fileName] = { 
      abort: false, 
      controller: new AbortController() 
    };

    startProgressAnimation(fileName, totalSize);

    let attempt = 0;
    while (attempt < MAX_RETRIES && !controllers.current[fileName].abort) {
      try {
        await downloadWithControlledSpeed(fileName, totalSize);
        break;
      } catch (err) {
        console.error(`Download attempt ${attempt + 1} failed:`, err);
        attempt++;
        
        if (attempt >= MAX_RETRIES) {
          setDownloadingFlag(fileName, false);
          setDownloadState(fileName, 'error');
          return;
        }
        
        await sleep(1000 * attempt);
      }
    }
  }

  function pauseDownload(fileName) {
    const ctl = controllers.current[fileName];
    if (!ctl) return;
    
    ctl.abort = true;
    try { 
      ctl.controller.abort(); 
    } catch {}
    
    if (animationFrames.current[fileName]) {
      cancelAnimationFrame(animationFrames.current[fileName]);
    }
    
    setDownloadingFlag(fileName, false);
    setDownloadState(fileName, 'paused');
  }

  async function cancelDownload(fileName) {
    const ctl = controllers.current[fileName];
    if (ctl) {
      ctl.abort = true;
      try { 
        ctl.controller.abort(); 
      } catch {}
    }
    
    if (animationFrames.current[fileName]) {
      cancelAnimationFrame(animationFrames.current[fileName]);
      delete animationFrames.current[fileName];
    }
    
    await clearParts(fileName);
    await clearMeta(fileName);
    
    setProgressValue(fileName, 0);
    setDownloadingFlag(fileName, false);
    setDownloadState(fileName, 'idle');
    
    delete downloadSimulators.current[fileName];
  }

  // Helper functions
  const getProgressText = (fileName) => {
    const currentProgress = progress[fileName] || 0;
    const totalSize = downloadSimulators.current[fileName]?.totalSize || 0;
    
    if (!totalSize) return '';
    
    const downloaded = formatBytes((totalSize * currentProgress) / 100);
    const total = formatBytes(totalSize);
    
    return `${downloaded} / ${total}`;
  };

  const getProgressBarWidth = (fileName) => {
    return progress[fileName] || 0;
  };

  const getProgressBarClass = (fileName) => {
    const state = downloadStates[fileName];
    if (state === 'completed') return 'download-completed';
    if (state === 'error') return 'download-error';
    if (state === 'paused') return 'download-paused';
    return '';
  };

  const getFormattedDate = () => {
    const now = new Date();
    return now.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Auto-resume
  useEffect(() => {
    (async () => {
      try {
        const db = await openDb();
        const tx = db.transaction("file_parts", "readonly");
        const store = tx.objectStore("file_parts");
        const req = store.openCursor();
        
        req.onsuccess = (ev) => {
          const cursor = ev.target.result;
          if (cursor) {
            const fileName = cursor.key;
            getDownloadedBytes(fileName).then(downloaded => {
              if (downloaded > 0) {
                getMeta(fileName).then(meta => {
                  const total = meta?.totalSize;
                  if (total) {
                    const progress = (downloaded / total) * 100;
                    setProgressValue(fileName, progress);
                    const status = progress === 100 ? 'completed' : 'paused';
                    setDownloadState(fileName, status);
                  }
                });
              }
            });
            cursor.continue();
          }
        };
      } catch (err) {
        console.error("Auto-resume error:", err);
      }
    })();
  }, []);

  return { 
    progress, 
    downloading, 
    downloadStates,
    startDownload, 
    pauseDownload, 
    cancelDownload,
    getProgressText,
    getFormattedDate,
    getProgressBarWidth,
    getProgressBarClass
  };
}