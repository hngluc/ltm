# Các chức năng cơ bản:
 🔹 1. Quản lý kết nối Client

Lắng nghe kết nối (Listen for connections): Server mở một cổng (port) nhất định, ví dụ 8888, và chờ client kết nối.

Xử lý nhiều client đồng thời: Server nên hỗ trợ đa luồng để nhiều client có thể tải file cùng lúc.

🔹 2. Xử lý yêu cầu tải file

Nhận yêu cầu từ client: Client gửi thông tin gồm:

Tên file cần tải.

Vị trí bắt đầu (startByte) → phục vụ resume.

Kiểm tra sự tồn tại file: Nếu file không tồn tại, server gửi thông báo lỗi.

Gửi dữ liệu file: Dùng luồng (stream) đọc file từ startByte và gửi từng chunk dữ liệu đến client.

🔹 3. Hỗ trợ Resume Download

Cho phép client tải tiếp từ phần dở dang:

Client gửi yêu cầu "filename + startByte".

Server dùng RandomAccessFile.seek(startByte) để đọc tiếp từ byte đó.

🔹 4. Quản lý danh sách file

Liệt kê file có sẵn: Client có thể yêu cầu server trả về danh sách file trong thư mục chia sẻ.

Thông tin file: Server có thể gửi metadata như: tên file, kích thước, ngày tạo.

http://localhost:8080/api/files
