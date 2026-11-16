# 04: Phát hiện cú vung

**What to build:** Khi người chơi vung điện thoại như vung vợt, điện thoại tự nhận ra cú vung và gửi một sự kiện đánh kèm lực. Máy tính hiện cú vung (vợt vụt, thanh lực) và phát âm thanh; điện thoại rung nếu máy hỗ trợ. Cử động nhẹ khi cầm máy không bị tính là cú vung.

**Blocked by:** 03 Vợt xoay theo điện thoại

**Status:** needs-device-test

- [x] Cú vung được phát hiện ngay trên điện thoại và gửi dưới dạng một sự kiện có lực và thời điểm
- [x] Vung mạnh cho lực lớn hơn vung nhẹ một cách nhất quán
- [ ] Cầm máy đi lại hoặc xoay chậm không tạo cú vung giả
- [x] Một lần vung chỉ tạo đúng một sự kiện
- [x] Máy tính có phản hồi hình và tiếng cho mỗi cú vung; điện thoại rung trên máy hỗ trợ
- [x] Bộ phát hiện cú vung có test tự động với các chuỗi dữ liệu cảm biến ghi lại (vung mạnh, vung nhẹ, không vung)

**Ghi chú:** Đã kiểm chứng bằng test tự động trên Chromium với cảm biến giả lập. Chưa thử trên iPhone và điện thoại Android thật; ngưỡng nhận diện cú vung cần tinh chỉnh bằng dữ liệu ghi từ máy thật. Test dùng chuỗi dữ liệu tổng hợp (đường cong hình chuông), không phải dữ liệu ghi lại từ máy thật.
