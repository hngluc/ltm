    import { API_BASE } from './config';
    // Giả sử AuthContext export `logout` function trực tiếp hoặc qua useAuth
    // Nếu bạn export context trực tiếp, bạn cần import useContext và AuthContext
    // import { useContext } from 'react';
    // import { AuthContext } from './context/AuthContext'; 

    // Hàm helper để lấy token (giữ nguyên)
    const getToken = () => localStorage.getItem('token');

    // Hàm fetch có kèm token (THÊM LOG)
    export const authFetch = async (url, options = {}) => {
      const token = getToken();
      console.log("authFetch: Attempting fetch for URL:", url); // LOG 1
      console.log("authFetch: Token from localStorage:", token); // LOG 2: Token có lấy được không?

      const headers = {
        ...options.headers, // Giữ lại các header cũ (nếu có)
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log("authFetch: Added Authorization header."); // LOG 3: Header có được thêm không?
      } else {
        console.log("authFetch: No token found, proceeding without Authorization header."); // LOG 4
      }

      try {
        const response = await fetch(`${API_BASE || ""}${url}`, {
          ...options, // Giữ lại method, body,... cũ
          headers,   // Dùng header đã thêm token (hoặc không)
        });

        console.log(`authFetch: Response status for ${url}:`, response.status); // LOG 5: Status code trả về?

        // Tự động logout nếu gặp lỗi 401 hoặc 403 (Token hết hạn/không hợp lệ)
        if (response.status === 401 || response.status === 403) {
          console.error("authFetch: Received 401/403, logging out."); // LOG LỖI AUTH
          localStorage.removeItem('token');
          // Thông báo cho user hoặc redirect về trang login
          // Cách đơn giản nhất là reload trang, AuthContext sẽ tự xử lý
          window.location.reload(); 
          throw new Error(`Unauthorized (Status: ${response.status})`); // Ném lỗi để dừng xử lý
        }


        return response; // Trả về response nguyên gốc để component tự xử lý .json() hoặc lỗi

      } catch (error) {
         console.error(`authFetch: Fetch error for ${url}:`, error); // LOG LỖI FETCH
         throw error; // Ném lỗi ra để component gọi xử lý
      }
    };

    // Hàm upload có kèm token (giữ nguyên logic, chỉ gọi authFetch)
    export const authUpload = async (url, formData, options = {}) => {
      // Không cần set Content-Type, trình duyệt tự xử lý cho FormData
      // Chỉ cần gọi authFetch với method POST và body là formData
       console.log("authUpload: Calling authFetch for URL:", url); // LOG Upload
      return authFetch(url, {
        method: 'POST',
        body: formData,
        ...options, // Cho phép truyền thêm options nếu cần
      });
    };
    

