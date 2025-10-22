import { API_BASE } from './config';

// Hàm fetch "xịn" của chúng ta
export const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('authToken');

    // Chuẩn bị headers
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers, // Ghi đè header mặc định nếu cần
    };

    // Nếu có token, thêm vào header Authorization
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Gắn headers mới vào options
    const newOptions = {
        ...options,
        headers: headers,
    };

    // Gọi fetch gốc
    const response = await fetch(`${API_BASE || ""}${url}`, newOptions);

    if (!response.ok) {
        // Nếu lỗi 401 (Unauthorized) hoặc 403 (Forbidden) -> có thể token hết hạn
        if (response.status === 401 || response.status === 403) {
            console.error("Authentication error. Logging out.");
            // Xóa token hỏng và reload trang
            localStorage.removeItem('authToken');
            window.location.reload(); 
        }
        
        // Ném lỗi để component .catch()
        const errData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errData.message || 'Something went wrong');
    }

    // Nếu request không trả về nội dung (ví dụ: DELETE 204 No Content)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        return response.json(); // Trả về JSON
    } else {
        return response.text(); // Trả về text (hoặc blob, tùy nhu cầu)
    }
};

// Một phiên bản riêng cho upload (vì nó dùng FormData, không dùng JSON)
export const authUpload = async (url, formData) => {
    const token = localStorage.getItem('authToken');
    
    const headers = {}; // Không set 'Content-Type', trình duyệt sẽ tự làm
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE || ""}${url}`, {
        method: 'POST',
        body: formData,
        headers: headers,
    });
    
    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('authToken');
            window.location.reload();
        }
        const errData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errData.message || 'Upload failed');
    }

    return response.json();
};
