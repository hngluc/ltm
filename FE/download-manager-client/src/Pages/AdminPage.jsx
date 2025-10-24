import React, { useEffect, useMemo, useRef, useState } from "react";
import { listFiles, uploadFiles, renameFile, deleteFile } from "../services/filesApi";
import "./upload.css"; // dùng CSS bạn gửi trước đó

export default function AdminPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState([]);
  const inputRef = useRef(null);
  const [renameTarget, setRenameTarget] = useState(null); // {old, draft}
  const [msg, setMsg] = useState(null); // {type,text}

  const fmt = (n) => {
    if (n === 0) return "0 B";
    if (!n || n < 0) return "-";
    const k = 1024, u = ["B","KB","MB","GB","TB"];
    const i = Math.min(Math.floor(Math.log(n)/Math.log(k)), u.length-1);
    return `${parseFloat((n/Math.pow(k,i)).toFixed(2))} ${u[i]}`;
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listFiles();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setMsg({ type: "error", text: "Không tải được danh sách (kiểm tra token/CORS/URL)." });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const onPick = (e) => {
    const files = Array.from(e.target.files || []);
    setPicked(files);
    setMsg(files.length ? { type: "info", text: `${files.length} file được chọn` } : null);
  };

  const clearPick = () => {
    setPicked([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const doUpload = async () => {
    if (!picked.length || busy) return;
    setBusy(true);
    setMsg({ type: "info", text: "Đang upload…" });
    try {
      await uploadFiles(picked);
      setMsg({ type: "success", text: "✅ Upload thành công" });
      clearPick();
      await refresh();
    } catch (e) {
      console.error(e);
      const t = String(e).includes("Failed to fetch")
        ? "❌ Không kết nối được server (API_BASE/CORS/port)."
        : `❌ Upload lỗi: ${e.message}`;
      setMsg({ type: "error", text: t });
    } finally {
      setBusy(false);
    }
  };

  const startRename = (old) => setRenameTarget({ old, draft: old });
  const cancelRename = () => setRenameTarget(null);
  const confirmRename = async () => {
    if (!renameTarget) return;
    const { old, draft } = renameTarget;
    if (!draft || draft === old) { cancelRename(); return; }
    setBusy(true);
    try {
      await renameFile(old, draft);
      setMsg({ type: "success", text: `Đã đổi tên: ${old} → ${draft}` });
      setRenameTarget(null);
      await refresh();
    } catch (e) {
      setMsg({ type: "error", text: `Đổi tên lỗi: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (name) => {
    if (!window.confirm(`Xoá file "${name}"?`)) return;
    setBusy(true);
    try {
      await deleteFile(name);
      setMsg({ type: "success", text: `Đã xoá: ${name}` });
      await refresh();
    } catch (e) {
      setMsg({ type: "error", text: `Xoá lỗi: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const table = useMemo(() => (
    <div className="table-wrap">
      <table className="file-table">
        <thead>
          <tr>
            <th style={{width: "50%"}}>Tên file</th>
            <th>Kích thước</th>
            <th>Cập nhật</th>
            <th style={{textAlign:"right"}}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(f => {
            const isRenaming = renameTarget?.old === f.name;
            return (
              <tr key={f.name}>
                <td className="filecell">
                  <span className="fileicon">📄</span>
                  {!isRenaming ? (
                    <span className="filename" title={f.name}>{f.name}</span>
                  ) : (
                    <input
                      autoFocus
                      value={renameTarget.draft}
                      onChange={e=>setRenameTarget(rt=>({...rt, draft: e.target.value}))}
                      onKeyDown={e => {
                        if (e.key === "Enter") confirmRename();
                        if (e.key === "Escape") cancelRename();
                      }}
                      className="btn"
                      style={{ width: "100%" }}
                    />
                  )}
                </td>
                <td className="size">{fmt(f.size)}</td>
                <td className="size">{f.lastModified ? new Date(f.lastModified).toLocaleString() : "-"}</td>
                <td style={{ textAlign: "right" }}>
                  {!isRenaming ? (
                    <>
                      <button className="btn tiny" onClick={() => startRename(f.name)} disabled={busy}>Đổi tên</button>
                      <button className="btn tiny danger" onClick={() => doDelete(f.name)} disabled={busy}>Xoá</button>
                    </>
                  ) : (
                    <>
                      <button className="btn tiny" onClick={confirmRename} disabled={busy}>Lưu</button>
                      <button className="btn tiny ghost" onClick={cancelRename} disabled={busy}>Huỷ</button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && !loading && (
            <tr><td colSpan={4} style={{padding:14, color:"#9ca3af"}}>Chưa có file nào.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  ), [rows, renameTarget, busy]);

  return (
    <div className="upload-page">
      <div className="header">
        <div>
          <h2>🛠 Admin – Quản lý file</h2>
          <div className="muted">CRUD: xem, upload, đổi tên, xoá</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={refresh} disabled={busy || loading}>
            {loading ? "Đang tải…" : "🔄 Làm mới"}
          </button>
        </div>
      </div>

      {/* Khu upload */}
      <div className="dropzone">
        <div className="dz-icon">⬆️</div>
        <div className="dz-text">Chọn 1 hoặc nhiều file để upload (chỉ ADMIN)</div>
        <input ref={inputRef} type="file" multiple onChange={onPick} disabled={busy} />
        <div className="footer-actions">
          <button className="btn primary" onClick={doUpload} disabled={!picked.length || busy}>
            {busy ? "Đang gửi…" : `Upload ${picked.length || ""}`}
          </button>
          <button className="btn ghost" onClick={clearPick} disabled={!picked.length || busy}>Xoá chọn</button>
        </div>
      </div>

      {table}

      {/* Thông báo */}
      {msg && (
        <p
          className="status"
          style={{
            marginTop: 12,
            color:
              msg.type === "success" ? "#22c55e" :
              msg.type === "error"   ? "#ef4444" : "#cbd5e1"
          }}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
