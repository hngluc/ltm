// src/services/filesApi.js
import { API_BASE } from "../config";

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listFiles() {
  const res = await fetch(`${API_BASE}/files`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`List failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function uploadFiles(files) {
  const form = new FormData();
  [...files].forEach(f => form.append("files", f));
  const res = await fetch(`${API_BASE}/files/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function renameFile(oldName, newName) {
  const res = await fetch(`${API_BASE}/files/${encodeURIComponent(oldName)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ newName }),
  });
  if (!res.ok) throw new Error(`Rename failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function deleteFile(name) {
  const res = await fetch(`${API_BASE}/files/${encodeURIComponent(name)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status} ${await res.text()}`);
  return res.json();
}
