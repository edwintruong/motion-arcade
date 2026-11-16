# 01: Ghép cặp bằng mã phòng

**What to build:** Người chơi mở cùng một địa chỉ web trên máy tính và điện thoại. Máy tính tạo phòng và hiện mã phòng ngắn. Trên điện thoại, người chơi gõ mã phòng để vào. Cả hai màn hình báo "đã kết nối". Một server duy nhất phục vụ cả trang web lẫn kết nối thời gian thực, để chỉ cần chạy và deploy một thứ. Trang tự nhận biết đang mở trên điện thoại hay máy tính để hiện đúng giao diện (có nút đổi vai thủ công).

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Một lệnh duy nhất khởi động toàn bộ dự án ở chế độ dev
- [x] Máy tính tạo phòng và hiện mã phòng 4 ký tự, dễ đọc, không có ký tự dễ nhầm (0/O, 1/I)
- [x] Điện thoại gõ mã phòng đúng thì vào phòng; cả hai màn hình hiện trạng thái "đã kết nối"
- [x] Mã sai hoặc phòng không tồn tại thì điện thoại báo lỗi rõ ràng và cho gõ lại
- [x] Một bên rời đi thì bên kia thấy trạng thái "mất kết nối"
- [x] Định dạng tin nhắn giữa hai bên được khai báo ở một chỗ dùng chung, và lớp kết nối tách khỏi logic game để sau này đổi cách truyền mà không viết lại
- [x] Có test tự động cho việc tạo phòng, vào phòng, mã sai, và rời phòng
- [x] Có hướng dẫn ngắn cách mở trang dev trên điện thoại qua HTTPS (tunnel)
