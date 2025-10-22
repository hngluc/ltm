import React, { useRef, useState } from "react";
import axios from "axios";
import ProgressBar from "../components/ProgressBar";
import { useNavigate } from "react-router-dom";

const API_UPLOAD = "/files/upload";

export default function UploadPage() {
  const [queue, setQueue] = useState([]);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const pickFiles = (e) => {
    const files = Array.from(e.target.files || []);
    const mapped = files.map(f => ({ file: f, progress: 0, status: "Đợi upload" }));
    setQueue(prev => [...prev, ...mapped]);
  };

  const uploadAll = async () => {
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.status !== "queued") continue;

      const form = new FormData();
      form.append("files", item.file);
      setQueue(q => q.map((x, idx) => idx === i ? { ...x, status: "uploading" } : x));

      try {
        await axios.post(API_UPLOAD, form, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (e) => {
            const pct = Math.round((e.loaded * 100) / e.total);
            setQueue(q => q.map((x, idx) => idx === i ? { ...x, progress: pct } : x));
          }
        });
        setQueue(q => q.map((x, idx) => idx === i ? { ...x, status: "done" } : x));
      } catch (err) {
        setQueue(q => q.map((x, idx) => idx === i ? { ...x, status: "error" } : x));
      }
    }
  };

  const doneAndBack = () => navigate("/");

  return (
    <div className="upload-page">
      <h2>⬆️ Upload Files</h2>
      <p>Chọn hoặc kéo thả các file cần tải lên.</p>

      <div className="upload-controls">
        <button onClick={() => inputRef.current?.click()}>Chọn file</button>
        <button onClick={uploadAll} disabled={!queue.length}>Upload tất cả</button>
        <button onClick={doneAndBack}>← Quay lại danh sách</button>
      </div>

      <input type="file" multiple hidden ref={inputRef} onChange={pickFiles} />

      {queue.length === 0 ? (
        <p>Chưa chọn file nào.</p>
      ) : (
        <table className="file-table">
          <thead>
            <tr>
              <th>Tên file</th>
              <th>Tiến trình</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((item, i) => (
              <tr key={i}>
                <td>{item.file.name}</td>
                <td>
                  <ProgressBar value={item.progress} />
                  <span>{item.progress}%</span>
                </td>
                <td>{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
