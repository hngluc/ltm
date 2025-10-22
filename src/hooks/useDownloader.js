// hooks/useDownloader.js
import { useState, useRef, useCallback } from 'react';
import { 
  savePart, 
  getParts, 
  clearParts, 
  saveMeta, 
  getMeta, 
  clearMeta, 
  getDownloadedBytes 
} from '../utils/idb';

const API_BASE = "http://localhost:8080";
const MAX_RETRIES = 5;

// Super Slow Download Simulator
class SuperSlowDownloadSimulator {
  constructor(totalSize, fileName) {
    this.totalSize = totalSize;
    this.fileName = fileName;
    this.startTime = Date.now();
    this.currentProgress = 0;
    this.isComplete = false;
    
    this.setForcedSlowTiming();
    
    console.log(`🚀 Bắt đầu tải "${fileName}" - ${this.formatBytes(totalSize)} - Thời gian tối thiểu: ${this.totalDuration/1000}s`);
  }

  setForcedSlowTiming() {
    const randomTime = Math.random() * 20000 + 10000; // 10-30 giây
    this.totalDuration = randomTime;
    this.speed = this.totalSize / (this.totalDuration / 1000);
  }

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

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
    const elapsed = now - this.startTime;
    const progressRatio = Math.min(elapsed / this.totalDuration, 0.99);
    
    const percentage = progressRatio * 100;
    const downloaded = Math.floor(this.totalSize * progressRatio);
    const speed = this.totalSize / (this.totalDuration / 1000);
    const remainingTime = Math.max(0, (this.totalDuration - elapsed) / 1000);

    this.currentProgress = percentage;

    return { percentage, downloaded, speed, timeRemaining: remainingTime };
  }

  markComplete() {
    this.isComplete = true;
    this.currentProgress = 100;
  }

  getChunkDelay() {
    return 300;
  }
}

export const useDownloader = () => {
  const [progress, setProgress] = useState({});
  const [downloading, setDownloading] = useState({});
  const [progressDetails, setProgressDetails] = useState({});
  const controllers = useRef({});
  const downloadSimulators = useRef({});
  const animationFrames = useRef({});

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const startProgressAnimation = useCallback((fileName, totalSize) => {
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
        animationFrames.current[fileName] = setTimeout(animate, 500);
      } else if (progress.percentage >= 99.9) {
        setTimeout(() => {
          simulator.markComplete();
          setProgress((s) => ({ ...s, [fileName]: 100 }));
          finalizeDownload(fileName);
        }, 1000);
      }
    };

    animate();
  }, []);

  const downloadWithForcedSlowness = useCallback(async (fileName, totalSize, simulator) => {
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
    let chunkCount = 0;

    try {
      while (!controllers.current[fileName].abort) {
        const { done, value } = await reader.read();
        if (done) break;

        chunkCount++;
        const chunkDelay = simulator.getChunkDelay();
        await new Promise(resolve => setTimeout(resolve, chunkDelay));

        const blob = new Blob([value], { type: "application/octet-stream" });
        await savePart(fileName, blob);

        downloaded += value.byteLength;

        console.log(`🐌 Chunk ${chunkCount}: ${formatBytes(downloaded)}/${formatBytes(totalSize)}`);

        if (downloaded >= totalSize) {
          console.log(`✅ Đã tải xong file nhưng đợi progress bar...`);
          break;
        }
      }
    } finally {
      try { reader.releaseLock(); } catch(e) {}
    }
  }, []);

  const finalizeDownload = useCallback(async (fileName) => {
    const parts = await getParts(fileName);
    if (!parts || parts.length === 0) return;
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
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
      clearTimeout(animationFrames.current[fileName]);
      delete animationFrames.current[fileName];
    }

    setDownloading((s) => ({ ...s, [fileName]: false }));
    delete downloadSimulators.current[fileName];
    
    alert(`✅ Tải thành công: ${fileName}`);
  }, []);

  const startDownload = useCallback(async (fileName, totalSize) => {
    if (downloading[fileName]) return;
    
    setDownloading((s) => ({ ...s, [fileName]: true }));
    setProgress((s) => ({ ...s, [fileName]: 0 }));

    downloadSimulators.current[fileName] = new SuperSlowDownloadSimulator(totalSize, fileName);
    controllers.current[fileName] = { abort: false, controller: new AbortController() };

    startProgressAnimation(fileName, totalSize);

    let attempt = 0;
    while (attempt < MAX_RETRIES && !controllers.current[fileName].abort) {
      try {
        await downloadWithForcedSlowness(fileName, totalSize, downloadSimulators.current[fileName]);
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
  }, [downloading, downloadWithForcedSlowness, startProgressAnimation]);

  const pauseDownload = useCallback((fileName) => {
    if (!controllers.current[fileName]) return;
    controllers.current[fileName].abort = true;
    try {
      controllers.current[fileName].controller.abort();
    } catch (e) {}
    
    if (animationFrames.current[fileName]) {
      clearTimeout(animationFrames.current[fileName]);
    }
    
    setDownloading((s) => ({ ...s, [fileName]: false }));
  }, []);

  const cancelDownload = useCallback(async (fileName) => {
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
  }, []);

  return {
    progress,
    downloading,
    progressDetails,
    startDownload,
    pauseDownload,
    cancelDownload,
    formatBytes
  };
};