# Đưa Motion Arcade lên web

Cả game là **một dịch vụ duy nhất**: cùng một tiến trình phục vụ trang web và WebSocket ghép phòng. Nền tảng nào chạy được Docker, có HTTPS và hỗ trợ WebSocket đều dùng được. HTTPS là bắt buộc, vì cảm biến chuyển động của điện thoại chỉ hoạt động trên HTTPS.

## Cách nhanh nhất: Render

Repo đã có sẵn `render.yaml` và `Dockerfile`.

Các bước chỉ bạn làm được:

1. Đẩy repo lên GitHub (thêm remote rồi `git push`).
2. Tạo tài khoản tại https://render.com và đăng nhập bằng GitHub.
3. Chọn **New → Blueprint**, chọn repo này, bấm **Apply**.

Render sẽ build từ `Dockerfile` và cấp một địa chỉ `https://….onrender.com`. Mở địa chỉ đó trên máy tính để lấy mã phòng, mở cùng địa chỉ trên điện thoại để nhập mã.

Từ đó, mỗi lần `git push` lên nhánh chính là Render tự deploy bản mới.

Lưu ý gói miễn phí: dịch vụ ngủ sau một lúc không ai dùng, nên lần mở đầu tiên có thể mất khoảng một phút.

## Nền tảng khác

Bất kỳ nơi nào chạy được container:

```bash
docker build -t motion-arcade .
docker run -p 3000:3000 motion-arcade
```

Dịch vụ nghe ở cổng lấy từ biến `PORT` (mặc định 3000) và trả `ok` tại `/healthz` để nền tảng kiểm tra sức khoẻ.

## Giới hạn cần biết

- Phòng nằm trong bộ nhớ của một tiến trình. Chỉ chạy **một bản** (không scale ngang), và mỗi lần deploy lại thì các phòng đang chơi bị đóng; người chơi chỉ cần tải lại trang.
- Một phòng bị xoá ngay khi máy tính tạo ra nó ngắt kết nối. Kết nối chết (rớt mạng không báo) được phát hiện bằng ping trong khoảng 15–30 giây.
- Chưa có giới hạn tốc độ hay chống lạm dụng; đủ cho bạn bè chơi với nhau, chưa đủ cho lượng truy cập công khai lớn.
