import React from "react";
import "./download.css";

export default function ProgressBar({ value = 0, downloadState = 'idle' }) {
  const pct = Math.min(100, Math.max(0, value));
  const isCompleted = downloadState === 'completed';
  const isError = downloadState === 'error';
  const isPaused = downloadState === 'paused';
  const isActive = downloadState === 'active';
  
  // Xác định class dựa trên state
  const getFillClass = () => {
    let className = "fill";
    if (isCompleted) className += " completed";
    if (isError) className += " error";
    if (isPaused) className += " paused";
    if (isActive) className += " active";
    return className;
  };

  return (
    <div className="progress-bar">
      <div 
        className={getFillClass()} 
        style={{ width: `${pct}%` }} 
      />
    </div>
  );
}