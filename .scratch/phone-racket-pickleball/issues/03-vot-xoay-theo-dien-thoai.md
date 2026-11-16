# 03: Vợt xoay theo điện thoại

**What to build:** Sau khi vào phòng, điện thoại hiện một nút lớn để xin quyền cảm biến chuyển động. Khi được phép, cây vợt 3D trên máy tính xoay theo đúng cách người chơi xoay điện thoại. Người chơi chĩa điện thoại vào màn hình và bấm "căn chỉnh" để đặt lại hướng thẳng. Màn hình máy tính hiện số đo độ trễ để đánh giá cảm giác.

**Blocked by:** 01 Ghép cặp bằng mã phòng

**Status:** needs-device-test

- [ ] Quyền cảm biến được xin sau một lần bấm của người dùng, hoạt động trên cả iPhone (Safari) và Android (Chrome)
- [x] Từ chối quyền hoặc máy không có cảm biến thì hiện hướng dẫn rõ ràng thay vì màn hình trống
- [ ] Vợt 3D trên máy tính xoay theo điện thoại mượt, không giật, đúng chiều trên cả iOS và Android
- [x] Nút căn chỉnh đặt lại hướng thẳng của vợt
- [x] Máy tính hiện độ trễ ước lượng và tần suất nhận dữ liệu
- [x] Phần chuyển dữ liệu cảm biến thành hướng vợt có test tự động với dữ liệu mẫu

**Ghi chú:** Đã kiểm chứng bằng test tự động trên Chromium với cảm biến giả lập. Chưa thử trên iPhone và điện thoại Android thật; ngưỡng nhận diện cú vung cần tinh chỉnh bằng dữ liệu ghi từ máy thật.
