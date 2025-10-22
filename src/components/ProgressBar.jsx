// components/ProgressBar.jsx
import React from 'react';

const ProgressBar = ({ value = 0, downloadedBytes = 0, totalBytes = 0, speed = 0, timeRemaining = 0 }) => {
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
};

export default ProgressBar;