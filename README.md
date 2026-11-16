# Motion Arcade

Chơi game thể thao trên máy tính, dùng điện thoại làm tay cầm chuyển động. Game đầu tiên là pickleball; cầu lông, bóng bàn và nhảy dây sẽ dùng chung phần ghép cặp và cảm biến.

## Chạy thử

```bash
npm install
npm run dev
```

Mở http://localhost:3000 trên máy tính để tạo phòng và lấy mã phòng 4 ký tự. Mở cùng địa chỉ trên điện thoại rồi nhập mã.

Trang tự chọn giao diện theo thiết bị. Để ép vai, thêm `?role=host` hoặc `?role=controller` vào địa chỉ (tiện khi thử hai tab trên cùng máy tính).

## Mở trên điện thoại qua HTTPS

Cảm biến chuyển động của điện thoại chỉ hoạt động trên HTTPS, và điện thoại không vào được `localhost` của máy tính. Khi dev, dùng một tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

Lệnh in ra một địa chỉ `https://….trycloudflare.com`. Mở địa chỉ đó trên cả máy tính lẫn điện thoại.

## Lệnh

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Server dev, một cổng cho cả trang web và WebSocket |
| `npm test` | Chạy test |
| `npm run typecheck` | Kiểm tra kiểu |
| `npm run build` rồi `npm start` | Chạy bản production (cổng lấy từ `PORT`, mặc định 3000) |

## Cấu trúc

- `src/shared` — định dạng tin nhắn dùng chung giữa trình duyệt và server
- `src/server` — server phòng và điểm khởi động
- `src/client` — trang máy tính (host) và trang điện thoại (controller)
- `.scratch/` — các ticket công việc
