import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export default function AdminRoute() {
    const auth = useAuth();
    const location = useLocation();

    if (!auth.isLoggedIn) {
        // Nếu chưa đăng nhập, chuyển về /login
        // state: { from: location } để lưu lại trang user muốn vào
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    // Nếu đã đăng nhập, cho phép truy cập
    return <Outlet />;
}
