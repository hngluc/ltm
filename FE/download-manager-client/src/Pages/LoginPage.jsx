import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext'; // Chỉ cần import useAuth
import { useNavigate, useLocation } from 'react-router-dom';
import './Login.css'; // File CSS cho trang Login

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const { login } = useAuth(); // Chỉ cần lấy hàm login từ context
    const navigate = useNavigate();
    const location = useLocation();

    // State để theo dõi component còn mount không (tránh lỗi state update)
    const [isMounted, setIsMounted] = useState(true);
    useEffect(() => {
        setIsMounted(true);
        return () => setIsMounted(false); // Cleanup khi unmount
    }, []);

    // Đường dẫn muốn đến sau khi login thành công
    const from = location.state?.from?.pathname || "/"; // Mặc định về trang chủ sau login

    // Hàm xử lý submit form
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return; // Chặn double submit

        setLoading(true);
        setError(null);
        console.log("LoginPage: Calling context login for user:", username); 

        try {
            // *** CHỈ GỌI HÀM LOGIN TỪ CONTEXT ***
            const success = await login(username, password); 
            // *** KHÔNG CÓ fetch Ở ĐÂY NỮA ***

            if (success && isMounted) {
                 console.log("LoginPage: Context login successful. Navigating to:", from);
                 navigate(from, { replace: true });
            }
        } catch (err) {
            if (isMounted) {
                console.error("LoginPage: Error received from context login:", err);
                setError(err.message || "Đã xảy ra lỗi không mong muốn.");
                setLoading(false); 
            }
        }
    };

    // Phần JSX render form (giữ nguyên)
    return (
        <div className="login-container">
            <form className="login-form" onSubmit={handleSubmit}>
                <h2>Đăng nhập Admin</h2>
                {error && <p className="error-message">{error}</p>}
                <div className="form-group">
                    <label htmlFor="username">Username</label>
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        disabled={loading} 
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading} 
                    />
                </div>
                <button type="submit" className="button login-button" disabled={loading}>
                    {loading ? 'Đang xử lý...' : 'Đăng nhập'}
                </button>
            </form>
        </div>
    );
}

