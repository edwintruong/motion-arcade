# 11: Đấu online hai máy

**What to build:** Hai người ở hai nơi khác nhau, mỗi người có máy tính và điện thoại riêng, vào cùng một trận bằng mã trận. Mỗi người nhìn sân từ phía mình trên màn hình của mình và đấu một trận đầy đủ luật. Giữa hai cú đánh, quỹ đạo bóng tính trước được, nên hai máy chỉ cần đồng bộ các sự kiện đánh và kết quả từng lượt.

**Blocked by:** 10 Hai người chung màn hình

**Status:** done

- [x] Một người tạo trận online và nhận mã trận; người kia nhập mã trên máy tính của mình để vào
- [x] Mỗi người ghép điện thoại riêng với máy tính của mình
- [x] Mỗi màn hình hiện sân từ góc nhìn của người chơi đó
- [x] Hai máy luôn thống nhất về điểm số và kết quả từng lượt
- [x] Trận đấu vẫn chơi được với độ trễ mạng thông thường, bóng không nhảy giật trên màn hình
- [x] Một người rời trận thì người kia được thông báo và trận kết thúc gọn gàng
- [x] Việc đồng bộ có test tự động mô phỏng hai máy với độ trễ

**Ghi chú:** Độ trễ được kiểm bằng mô phỏng (0–0,3 giây mỗi chiều); chưa thử qua Internet thật giữa hai nơi.
