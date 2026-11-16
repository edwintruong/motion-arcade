# Motion Arcade

Chơi game thể thao trên máy tính, dùng điện thoại làm vợt: vung điện thoại là đánh bóng. Điện thoại chỉ cần mở trang web, không cài app.

Game đầu tiên là pickleball: tập đánh, đấu với máy (3 mức), hai người chung màn hình, và đấu online hai máy. Cầu lông, bóng bàn và nhảy dây sẽ dùng chung phần ghép cặp và cảm biến.

## Chạy thử

```bash
npm install
npm run dev
```

Mở http://localhost:3000 trên máy tính để tạo phòng và lấy mã phòng 4 ký tự. Mở cùng địa chỉ trên điện thoại rồi nhập mã.

Trang tự chọn giao diện theo thiết bị. Để ép vai, thêm `?role=host` hoặc `?role=controller` vào địa chỉ. Mở tab `?role=controller` trên máy tính cũng chơi được bằng các nút bấm thay cho cú vung, tiện khi chưa có điện thoại.

## Mở trên điện thoại qua HTTPS

Cảm biến chuyển động của điện thoại chỉ hoạt động trên HTTPS, và điện thoại không vào được `localhost` của máy tính. Khi dev, dùng một tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

Lệnh in ra một địa chỉ `https://….trycloudflare.com`. Mở địa chỉ đó trên cả máy tính lẫn điện thoại.

### Hoặc: mở cho mọi thiết bị cùng mạng wifi

```bash
LAN_IP=192.168.0.154 npm run dev:lan
```

Lệnh này chạy server bằng HTTPS với chứng chỉ tự ký và in ra địa chỉ `https://<IP>:3000`. Lần đầu mỗi thiết bị sẽ thấy cảnh báo chứng chỉ: chọn Nâng cao → Tiếp tục.

`LAN_IP` là địa chỉ của máy tính trong mạng wifi (xem bằng `ipconfig` trên Windows). Chạy trực tiếp trên Linux/macOS thì bỏ được biến này.

Nếu chạy trong WSL2, Windows phải chuyển tiếp cổng vào WSL. Mở PowerShell **bằng quyền Administrator** và chạy một lần (thay `<IP-WSL>` bằng kết quả của `hostname -I` trong WSL; địa chỉ này có thể đổi sau khi khởi động lại máy):

```powershell
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=<IP-WSL>
New-NetFirewallRule -DisplayName "Motion Arcade dev" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

Cách đưa lên web lâu dài: xem [docs/DEPLOY.md](docs/DEPLOY.md). Bản đã deploy cài được về máy tính như một ứng dụng (PWA) từ nút cài đặt của trình duyệt.

## Cách chơi

1. Cầm điện thoại như cán vợt, bấm **Bật cảm biến chuyển động**.
2. Chĩa đầu điện thoại vào màn hình rồi bấm **Căn chỉnh**.
3. Nhân vật tự chạy tới bóng; bạn chỉ lo vung đúng lúc.
   - Vung sớm hay muộn làm bóng lệch sang hai bên; vung mạnh thì bóng đi nhanh và sâu, mạnh quá thì ra ngoài.
   - Vung ngang là thuận tay hoặc trái tay, hất lên là lốp, chém xuống là đập.
4. Luật pickleball đơn: giao bóng chéo sân, cú giao và cú trả giao phải để nảy rồi mới đánh, không vô-lê khi đứng trong vùng cấm sát lưới, chỉ bên giao bóng mới ghi điểm, đánh tới 11 và hơn 2 điểm.

Đấu online: một người bấm **Tạo trận** và gửi mã phòng của mình; người kia nhập mã đó vào ô **Mã của bạn bè** rồi bấm **Vào trận**. Mỗi người vẫn ghép điện thoại với mã phòng trên máy của chính mình.

## Lệnh

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Server dev, một cổng cho cả trang web và WebSocket |
| `npm run dev:lan` | Server dev qua HTTPS tự ký, cho các thiết bị cùng mạng |
| `npm test` | Test logic: server phòng, nhận diện cú vung, luật, đối thủ máy, đồng bộ online |
| `npm run e2e` | Test trên trình duyệt thật với cảm biến giả lập (cần `npx playwright install --with-deps chromium` một lần) |
| `npm run typecheck` | Kiểm tra kiểu |
| `npm run build` rồi `npm start` | Chạy bản production (cổng lấy từ `PORT`, mặc định 3000) |

## Cấu trúc

- `src/shared` — phần dùng chung, không gắn với game nào: giao thức phòng, tin nhắn điện thoại ↔ máy tính, toán quaternion, nhận diện cử chỉ (`gestures/`)
- `src/server` — server phòng: ghép cặp và chuyển tiếp, không biết gì về luật game
- `src/games/pickleball` — mô phỏng thuần của pickleball: vật lý bóng, luật, tính điểm, đối thủ máy, đồng bộ online
- `src/client/controller` — trang điện thoại
- `src/client/host` — trang máy tính: menu, hình 3D, âm thanh
- `e2e` — test trình duyệt
- `.scratch/` — các ticket công việc

Thêm một môn mới nghĩa là thêm một thư mục trong `src/games` và một phiên chơi trong `src/client/host`; server và trang điện thoại dùng lại nguyên. Môn nào cần cử chỉ khác (ví dụ cú nhảy cho nhảy dây) thì thêm bộ nhận diện vào `src/shared/gestures`.
