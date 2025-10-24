// src/utils/auth.js
function base64UrlDecode(s) {
  // đổi base64url -> base64 rồi decode
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  const json = atob(s);
  try { return decodeURIComponent(escape(json)); } catch { return json; }
}

export function isAdminFromToken() {
  const token = localStorage.getItem("token");
  if (!token) return false;

  try {
    const [, payload] = token.split(".");
    const decoded = JSON.parse(base64UrlDecode(payload));

    // Hỗ trợ nhiều kiểu claim:
    // 1) roles: ["ADMIN"] hoặc ["ROLE_ADMIN"]
    // 2) authorities: ["ROLE_ADMIN"] hoặc [{authority:"ROLE_ADMIN"}]
    // 3) scope: "ADMIN" / "ROLE_ADMIN" / "read write ADMIN"
    const raw =
      decoded.roles ??
      decoded.authorities ??
      decoded.scope ??
      decoded.role ??
      [];

    const list = Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? raw.split(/\s+/)
        : Array.isArray(decoded.authorities)
          ? decoded.authorities
          : [];

    // Chuẩn hoá thành mảng string
    const strings = list.map((x) =>
      typeof x === "string" ? x : (x && x.authority) || ""
    );

    return strings.some((r) => r === "ADMIN" || r === "ROLE_ADMIN");
  } catch {
    return false;
  }
}
