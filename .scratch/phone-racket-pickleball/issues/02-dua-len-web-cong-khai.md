# 02: Đưa lên web công khai

**What to build:** Game chạy trên một địa chỉ HTTPS công khai. Bất kỳ ai có link đều mở được trên máy tính, tạo phòng, rồi mở cùng link trên điện thoại và gõ mã phòng để vào, không cần cài gì. Làm sớm vì cảm biến điện thoại chỉ hoạt động trên HTTPS, nên đây cũng là cách test thật dễ nhất.

**Blocked by:** 01 Ghép cặp bằng mã phòng

**Status:** ready-for-agent

- [ ] Toàn bộ game deploy thành một dịch vụ duy nhất trên một nền tảng có HTTPS và hỗ trợ WebSocket
- [ ] Ghép cặp bằng mã phòng hoạt động trên địa chỉ công khai, giữa máy tính và điện thoại dùng mạng khác nhau (wifi và 4G)
- [ ] Một lệnh hoặc một lần đẩy code là deploy được bản mới
- [ ] Có tài liệu ngắn về cách deploy và các bước chỉ con người làm được (tạo tài khoản, đăng nhập)
- [ ] Phòng không còn ai thì được dọn sau một khoảng thời gian, server không phình bộ nhớ
