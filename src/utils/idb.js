// src/utils/idb.js
const DB_NAME = "download_db_v1";
const STORE_NAME = "file_parts";
const CHUNK_STORE_META = "file_meta";

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
export async function savePart(file, blob){ const db=await openDb(); return new Promise((res,rej)=>{ const tx=db.transaction(STORE_NAME,"readwrite"); const st=tx.objectStore(STORE_NAME); const r=st.get(file); r.onsuccess=()=>{ const ex=r.result||{file,parts:[]}; ex.parts.push(blob); const p=st.put(ex); p.onsuccess=()=>res(true); p.onerror=()=>rej(p.error); }; r.onerror=()=>rej(r.error); });}
export async function getParts(file){ const db=await openDb(); return new Promise((res,rej)=>{ const tx=db.transaction(STORE_NAME,"readonly"); const st=tx.objectStore(STORE_NAME); const r=st.get(file); r.onsuccess=()=>res(r.result? r.result.parts:[]); r.onerror=()=>rej(r.error); });}
export async function clearParts(file){ const db=await openDb(); return new Promise((res,rej)=>{ const tx=db.transaction(STORE_NAME,"readwrite"); const st=tx.objectStore(STORE_NAME); const r=st.delete(file); r.onsuccess=()=>res(true); r.onerror=()=>rej(r.error); });}
export async function saveMeta(file, meta){ const db=await openDb(); return new Promise((res,rej)=>{ const tx=db.transaction(CHUNK_STORE_META,"readwrite"); const st=tx.objectStore(CHUNK_STORE_META); const p=st.put({file,...meta}); p.onsuccess=()=>res(true); p.onerror=()=>rej(p.error); });}
export async function getMeta(file){ const db=await openDb(); return new Promise((res,rej)=>{ const tx=db.transaction(CHUNK_STORE_META,"readonly"); const st=tx.objectStore(CHUNK_STORE_META); const r=st.get(file); r.onsuccess=()=>res(r.result||null); r.onerror=()=>rej(r.error); });}
export async function clearMeta(file){ const db=await openDb(); return new Promise((res,rej)=>{ const tx=db.transaction(CHUNK_STORE_META,"readwrite"); const st=tx.objectStore(CHUNK_STORE_META); const r=st.delete(file); r.onsuccess=()=>res(true); r.onerror=()=>rej(r.error); });}
