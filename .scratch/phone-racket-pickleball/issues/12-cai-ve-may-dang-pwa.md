# 12: Cài về máy dạng PWA

**What to build:** Người chơi cài game từ trình duyệt thành một ứng dụng trên máy tính, có biểu tượng riêng và mở trong cửa sổ riêng. Điện thoại vẫn vào bằng trang web và mã phòng như cũ.

**Blocked by:** 02 Đưa lên web công khai

**Status:** needs-human

- [ ] Trình duyệt trên máy tính hiện lựa chọn cài đặt game
- [ ] Ứng dụng đã cài có tên, biểu tượng và mở trong cửa sổ riêng
- [x] Giao diện và tài nguyên game tải được từ bộ nhớ đệm khi mạng chậm; khi không có mạng thì báo rõ là cần mạng để ghép điện thoại
- [x] Khi có bản mới, ứng dụng đã cài tự cập nhật ở lần mở sau

**Ghi chú:** Manifest, biểu tượng và service worker đã có và được test; nút cài đặt của trình duyệt chỉ xuất hiện trên HTTPS thật nên cần thử sau khi deploy (ticket 02).
