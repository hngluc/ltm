// utils/idb.js
export const DB_NAME = "download_db_v1";
export const STORE_NAME = "file_parts";
export const CHUNK_STORE_META = "file_meta";

export function openDb() {
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

export async function savePart(file, partBlob) {
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

export async function getParts(file) {
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

export async function clearParts(file) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(file);
    req.onsuccess = () => res(true);
    req.onerror = () => rej(req.error);
  });
}

export async function saveMeta(file, meta) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(CHUNK_STORE_META, "readwrite");
    const store = tx.objectStore(CHUNK_STORE_META);
    const putReq = store.put({ file, ...meta });
    putReq.onsuccess = () => res(true);
    putReq.onerror = () => rej(putReq.error);
  });
}

export async function getMeta(file) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(CHUNK_STORE_META, "readonly");
    const store = tx.objectStore(CHUNK_STORE_META);
    const req = store.get(file);
    req.onsuccess = () => res(req.result || null);
    req.onerror = () => rej(req.error);
  });
}

export async function clearMeta(file) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(CHUNK_STORE_META, "readwrite");
    const store = tx.objectStore(CHUNK_STORE_META);
    const req = store.delete(file);
    req.onsuccess = () => res(true);
    req.onerror = () => rej(req.error);
  });
}

export async function getDownloadedBytes(fileName) {
  const parts = await getParts(fileName);
  let total = 0;
  for (const p of parts) total += p.size || (p.byteLength || 0);
  return total;
}