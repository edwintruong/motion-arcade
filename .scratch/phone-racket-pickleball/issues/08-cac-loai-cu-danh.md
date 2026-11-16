# 08: Các loại cú đánh

**What to build:** Cách người chơi vung điện thoại tạo ra các cú đánh khác nhau: vung từ phải sang trái hay ngược lại cho thuận tay và trái tay, vung hất lên cho cú lốp bổng, vung chém xuống cho cú đập. Nhân vật trên màn hình diễn đúng động tác tương ứng.

**Blocked by:** 05 Đánh bóng tập

**Status:** needs-device-test

- [x] Phân biệt được thuận tay và trái tay theo chiều vung
- [x] Vung hất lên tạo cú lốp bay cao và chậm; vung chém xuống tạo cú đập nhanh và thấp
- [x] Nhân vật diễn động tác khớp với loại cú đánh
- [x] Người thuận tay trái chọn được tay cầm vợt
- [x] Bộ phân loại cú đánh có test tự động với dữ liệu cảm biến ghi lại cho từng loại

**Ghi chú:** Phân loại cú đánh đã test bằng dữ liệu tổng hợp; chọn tay trái/phải nằm trên trang điện thoại. Đã kiểm chứng bằng test tự động trên Chromium với cảm biến giả lập. Chưa thử trên iPhone và điện thoại Android thật; ngưỡng nhận diện cú vung cần tinh chỉnh bằng dữ liệu ghi từ máy thật.
