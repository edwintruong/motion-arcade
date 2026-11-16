# 05: Đánh bóng tập

**What to build:** Màn hình máy tính có sân pickleball 3D và một nhân vật cầm vợt. Máy phát bóng tới liên tục. Người chơi vung điện thoại đúng lúc thì đánh trúng và bóng bay sang sân bên kia; vung sai lúc thì hụt. Vung sớm hay muộn làm bóng lệch trái hoặc phải, vung mạnh làm bóng bay nhanh và xa hơn.

**Blocked by:** 04 Phát hiện cú vung

**Status:** ready-for-agent

- [ ] Có sân, lưới, bóng và nhân vật người chơi với hình ảnh tự tạo
- [ ] Bóng bay theo quỹ đạo có trọng lực và nảy trên mặt sân
- [ ] Chỉ đánh trúng khi cú vung rơi vào khoảng thời gian bóng ở trong tầm vợt
- [ ] Thời điểm vung quyết định hướng bóng; lực vung quyết định tốc độ bóng
- [ ] Bóng được phát lại tự động sau mỗi lượt, chơi liên tục không cần chạm máy tính
- [ ] Mô phỏng bóng và việc tính cú đánh chạy độc lập với phần hiển thị và có test tự động
