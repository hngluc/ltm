import { API_BASE } from './config';

// Hàm helper để lấy token (giữ nguyên)
const getToken = () => localStorage.getItem('token');

/**
 * Hàm fetch có kèm token xác thực.
 */
export const authFetch = async (url, options = {}) => {
  const token = getToken();
  console.log("authFetch: Attempting fetch for URL:", url); 
  console.log("authFetch: Token from localStorage:", token); 

  const headers = {
    ...options.headers, 
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log("authFetch: Added Authorization header."); 
  } else {
    console.log("authFetch: No token found, proceeding without Authorization header."); 
  }

  try {
    const response = await fetch(`${API_BASE || ""}${url}`, {
      ...options, // <-- **ĐÂY LÀ CHỖ TRUYỀN OPTION CỦA BẠN (TỪ authUpload)**
      headers,   
    });

    console.log(`authFetch: Response status for ${url}:`, response.status); 

    // Tự động logout nếu gặp lỗi 401 hoặc 403
    if (response.status === 401 || response.status === 403) {
      console.error("authFetch: Received 401/403, logging out."); 
      localStorage.removeItem('token');
      window.location.reload(); 
      throw new Error(`Unauthorized (Status: ${response.status})`); 
    }

    return response; 

  } catch (error) {
     console.error(`authFetch: Fetch error for ${url}:`, error); 
     throw error; 
  }
};

export const authUpload = async (url, formData, options = {}) => {
  console.log("authUpload: Calling authFetch for URL:", url); 

  // Hàm này gọi authFetch và TRUYỀN TIẾP options vào
  return authFetch(url, {
    method: 'POST',
    body: formData,
    ...options, 
  });
};