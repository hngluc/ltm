import { API_BASE } from './config';

/**
 * Lấy token xác thực từ localStorage.
 * @returns {string | null} Chuỗi token hoặc null nếu không có.
 */
const getToken = () => localStorage.getItem('token');

/**
 * Một hàm "wrapper" cho `fetch` của trình duyệt.
 * Tự động thêm 'Authorization: Bearer ...' header nếu token tồn tại.
 * Tự động xử lý lỗi 401/403 (Unauthorized/Forbidden) bằng cách logout.
 *
 * @param {string} url - Đường dẫn API (vd: '/upload/init')
 * @param {object} options - Các tùy chọn của fetch (method, body, headers...)
 * @returns {Promise<Response>} - Đối tượng Response của fetch
 */
export const authFetch = async (url, options = {}) => {
  const token = getToken();
  console.log(`authFetch: Đang gọi URL: ${url}`);

  // 1. Chuẩn bị headers
  const headers = {
    ...options.headers, // Lấy các header có sẵn từ options (nếu có)
  };

  // 2. Thêm token vào header nếu có
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log("authFetch: Đã thêm token vào header.");
  } else {
    console.warn("authFetch: Không tìm thấy token. Request sẽ không được xác thực.");
  }

  // 3. Thực hiện gọi fetch
  try {
    // ---- ĐÂY LÀ DÒNG QUAN TRỌNG NHẤT ----
    // Nó ghép API_BASE (từ config.js) với url bạn truyền vào.
    // Nếu API_BASE là "http://localhost:8080/api " (có dấu cách)
    // và url là "/upload/init"
    // -> kết quả sẽ là "http://localhost:8080/api /upload/init" -> GÂY LỖI 403
    //
    // Nếu API_BASE là "http://localhost:8080/api" (không có dấu cách)
    // và url là "/upload/init"
    // -> kết quả sẽ là "http://localhost:8080/api/upload/init" -> ĐÚNG
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers, // Ghi đè headers với phiên bản đã có token
    });

    console.log(`authFetch: Response status cho ${url}: ${response.status}`);

    // 4. Tự động logout nếu token hết hạn hoặc không hợp lệ
    // (Server trả về 401 hoặc 403)
    if (response.status === 401 || response.status === 403) {
      console.error(`authFetch: Lỗi ${response.status}! Token không hợp lệ. Đang logout...`);
      localStorage.removeItem('token');
      localStorage.removeItem('authorities');
      // Tải lại trang để đưa người dùng về trang login
      window.location.reload();
      throw new Error(`Lỗi xác thực (Status: ${response.status})`);
    }

    // 5. Trả về response nếu mọi thứ ổn
    return response;

  } catch (error) {
    console.error(`authFetch: Gặp lỗi khi fetch ${url}:`, error);
    throw error; // Ném lỗi ra để component gọi nó có thể xử lý
  }
};

/**
 * Hàm tiện ích chuyên dùng để upload file (POST FormData).
 *
 * @param {string} url - Đường dẫn API để upload
 * @param {FormData} formData - Dữ liệu form chứa file
 * @param {object} options - Các tùy chọn fetch khác (vd: onUploadProgress)
 * @returns {Promise<Response>}
 */
export const authUpload = async (url, formData, options = {}) => {
  console.log(`authUpload: Đang gọi authFetch cho ${url}`);

  // Hàm này chỉ gọi authFetch với method: 'POST' và body là formData.
  // Nó không thêm 'Content-Type': 'multipart/form-data'.
  // Trình duyệt sẽ tự động thêm header này (cùng với 'boundary') khi body là FormData.
  return authFetch(url, {
    method: 'POST',
    body: formData,
    ...options, // Truyền các options khác vào, ví dụ 'onUploadProgress'
  });
};

/**
 * Hàm tiện ích cho các request GET (ví dụ: lấy danh sách file)
 * @param {string} url - Đường dẫn API
 * @param {object} options - Các tùy chọn fetch khác
 * @returns {Promise<Response>}
 */
export const authGet = (url, options = {}) => {
  return authFetch(url, {
    method: 'GET',
    ...options,
  });
};

/**
 * Hàm tiện ích cho các request POST/PUT gửi JSON
 * @param {string} url - Đường dẫn API
 * @param {object} body - Dữ liệu JavaScript (sẽ được stringify)
 * @param {string} method - 'POST' (mặc định) hoặc 'PUT'
 * @param {object} options - Các tùy chọn fetch khác
 * @returns {Promise<Response>}
 */
export const authPostJson = (url, body, method = 'POST', options = {}) => {
  return authFetch(url, {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(body),
    ...options,
  });
};
