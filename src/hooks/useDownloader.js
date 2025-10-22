// src/hooks/useDownloader.js
import { useEffect, useRef, useState } from "react";
import { API_BASE, MAX_RETRIES } from "../config";
import {
  openDb, getMeta, saveMeta, getParts, savePart, clearMeta, clearParts,
} from "../utils/idb";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const makeSessionId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export function useDownloader() {
  const [progress, setProgress] = useState({});     // % hiển thị (ưu tiên SSE)
  const [downloading, setDownloading] = useState({});
  const controllers = useRef({});                   // { fileName: { abort, controller } }
  const sseRefs = useRef({});                       // { fileName: EventSource }
  const stateMeta = useRef({});                     // { fileName: { downloaded, total } }

  const setProgressValue = (file, pct) =>
    setProgress((prev) => ({ ...prev, [file]: pct }));
  const setDownloadingFlag = (file, bool) =>
    setDownloading((prev) => ({ ...prev, [file]: bool }));

  // ===== SSE =====
  function subscribeSse(sessionId, fileName) {
    const es = new EventSource(`${API_BASE || ""}/files/progress/subscribe?sessionId=${encodeURIComponent(sessionId)}`);
    es.addEventListener("progress", (e) => {
      try {
        const data = JSON.parse(e.data); // {percent, sent, total}
        setProgressValue(fileName, data.percent ?? 0);
      } catch {}
    });
    es.addEventListener("done", () => {
      es.close();
      delete sseRefs.current[fileName];
    });
    es.onerror = () => {
      es.close();
      delete sseRefs.current[fileName];
    };
    sseRefs.current[fileName] = es;
  }

  function closeSse(fileName) {
    const es = sseRefs.current[fileName];
    if (es) {
      try { es.close(); } catch {}
      delete sseRefs.current[fileName];
    }
  }

  // ===== IndexedDB helpers =====
  async function getDownloadedBytes(fileName) {
    const parts = await getParts(fileName);
    return parts.reduce((sum, p) => sum + (p.size || p.byteLength || 0), 0);
  }

  async function finalizeAndTrigger(fileName) {
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
    setProgressValue(fileName, 100);
    closeSse(fileName);
  }

  // ===== Core: stream download (vẫn giữ để resume/offline) =====
  async function downloadLoop(fileName, sessionId) {
    const meta = (await getMeta(fileName)) || {};
    let totalSize = meta.totalSize || null;
    let downloaded = await getDownloadedBytes(fileName);

    if (totalSize && downloaded >= totalSize) {
      await finalizeAndTrigger(fileName);
      return;
    }

    // HEAD-lite để lấy totalSize nếu chưa có
    if (!totalSize) {
      const headResp = await fetch(`${API_BASE || ""}/files/${encodeURIComponent(fileName)}?sessionId=${encodeURIComponent(sessionId)}`, {
        method: "GET",
        headers: { Range: "bytes=0-0" }
      });
      if (headResp.status === 206 || headResp.status === 200) {
        const cr = headResp.headers.get("Content-Range");
        const cl = headResp.headers.get("Content-Length");
        if (cr && cr.includes("/")) totalSize = parseInt(cr.split("/")[1], 10);
        else if (cl) totalSize = parseInt(cl, 10);
        await saveMeta(fileName, { totalSize });
      }
      try { headResp?.body?.cancel(); } catch {}
    }

    // yêu cầu phần còn lại
    const startByte = downloaded;
    const headers = {};
    if (startByte > 0) headers["Range"] = `bytes=${startByte}-`;

    const ctl = controllers.current[fileName].controller;
    const resp = await fetch(`${API_BASE || ""}/files/${encodeURIComponent(fileName)}?sessionId=${encodeURIComponent(sessionId)}`, {
      method: "GET",
      headers,
      signal: ctl.signal
    });

    if (!(resp.status === 200 || resp.status === 206)) {
      throw new Error("Unexpected status " + resp.status);
    }

    // cập nhật total từ header
    const contentRange = resp.headers.get("Content-Range");
    if (contentRange && contentRange.includes("/")) {
      const total = parseInt(contentRange.split("/")[1], 10);
      totalSize = total;
      await saveMeta(fileName, { totalSize });
      stateMeta.current[fileName].total = totalSize;
    } else {
      const cl = resp.headers.get("Content-Length");
      if (cl && !totalSize) {
        totalSize = parseInt(cl, 10) + startByte;
        await saveMeta(fileName, { totalSize });
        stateMeta.current[fileName].total = totalSize;
      }
    }

    // stream
    const reader = resp.body.getReader();
    while (!controllers.current[fileName].abort) {
      const { done, value } = await reader.read();
      if (done) break;
      const blob = new Blob([value.buffer ? value.buffer : value], { type: "application/octet-stream" });
      await savePart(fileName, blob);

      downloaded += value.byteLength || value.length || blob.size;
      stateMeta.current[fileName].downloaded = downloaded;

      // fallback (chỉ update nếu chưa có SSE)
      if (!sseRefs.current[fileName]) {
        if (totalSize) {
          const pct = Math.min(100, Math.round((downloaded * 100) / totalSize));
          setProgressValue(fileName, pct);
        } else {
          setProgressValue(fileName, Math.min(99, Math.round(downloaded / 1024 / 1024)));
        }
      }
      await saveMeta(fileName, { totalSize });
    }
    try { reader.releaseLock && reader.releaseLock(); } catch {}

    if (controllers.current[fileName].abort) return;

    if (totalSize) {
      const finalDownloaded = await getDownloadedBytes(fileName);
      if (finalDownloaded >= totalSize) await finalizeAndTrigger(fileName);
    } else {
      await finalizeAndTrigger(fileName);
    }
  }

  // ===== Public API =====
  async function startDownload(fileName) {
    if (downloading[fileName]) return;

    setDownloadingFlag(fileName, true);
    setProgressValue(fileName, 0);

    const sessionId = makeSessionId();
    subscribeSse(sessionId, fileName); // mở SSE trước khi tải

    const meta = (await getMeta(fileName)) || {};
    const existingBytes = await getDownloadedBytes(fileName);
    stateMeta.current[fileName] = { downloaded: existingBytes, total: meta.totalSize || null };

    controllers.current[fileName] = { abort: false, controller: new AbortController() };

    let attempt = 0;
    while (attempt < MAX_RETRIES && !controllers.current[fileName].abort) {
      try {
        await downloadLoop(fileName, sessionId);
        break; // thành công
      } catch (err) {
        attempt++;
        if (attempt >= MAX_RETRIES) {
          alert(`Tải thất bại: ${fileName}`);
          setDownloadingFlag(fileName, false);
          closeSse(fileName);
          return;
        }
        await sleep(1000 * attempt);
      }
    }
    setDownloadingFlag(fileName, false);
    // đóng SSE sẽ được gọi khi server gửi "done"; nhưng đảm bảo:
    setTimeout(() => closeSse(fileName), 2000);
  }

  function pause(fileName) {
    const ctl = controllers.current[fileName];
    if (!ctl) return;
    ctl.abort = true;
    try { ctl.controller.abort(); } catch {}
    setDownloadingFlag(fileName, false);
    // không clear parts/meta -> resume được
  }

  async function cancel(fileName) {
    const ctl = controllers.current[fileName];
    if (ctl) {
      ctl.abort = true;
      try { ctl.controller.abort(); } catch {}
    }
    await clearParts(fileName);
    await clearMeta(fileName);
    setProgressValue(fileName, 0);
    setDownloadingFlag(fileName, false);
    closeSse(fileName);
  }

  // (tuỳ chọn) auto-resume khi mount
  useEffect(() => {
    (async () => {
      const db = await openDb();
      const tx = db.transaction("file_parts", "readonly");
      const store = tx.objectStore("file_parts");
      const req = store.openCursor();
      req.onsuccess = (ev) => {
        const cursor = ev.target.result;
        if (cursor) {
          const file = cursor.key;
          // không auto resume SSE (vì sessionId mới). Người dùng bấm Resume sẽ tạo session SSE mới.
          cursor.continue();
        }
      };
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { progress, downloading, startDownload, pause, cancel };
}
