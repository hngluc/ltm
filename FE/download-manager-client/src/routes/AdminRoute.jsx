import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

function parseJwt(token) {
  try { return JSON.parse(atob(token.split(".")[1])); } catch { return {}; }
}

export default function AdminRoute({ children }) {
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setAllowed(false); setReady(true); return; }

    const payload = parseJwt(token);
    const roles = payload?.roles || payload?.authorities || payload?.scope || [];
    const isAdmin = Array.isArray(roles)
      ? roles.includes("ADMIN") || roles.includes("ROLE_ADMIN")
      : String(roles).includes("ADMIN");

    setAllowed(!!isAdmin);
    setReady(true);
  }, []);

  if (!ready) return <div style={{padding:24}}>Đang kiểm tra quyền truy cập…</div>;
  if (!allowed) return <Navigate to="/login" state={{ from: location }} replace />;

  return children; // QUAN TRỌNG
}
