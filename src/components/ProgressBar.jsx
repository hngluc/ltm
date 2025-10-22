import React from "react";

export default function ProgressBar({ value = 0 }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="progress-bar">
      <div className="fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

