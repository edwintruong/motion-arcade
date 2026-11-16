import { connect } from "./connection";

/** The computer: creates a room and shows its code for a phone to type. */
export function showHost(app: HTMLElement) {
  app.innerHTML = `
    <h1>Motion Arcade</h1>
    <p>Mở <strong>${location.host}</strong> trên điện thoại rồi nhập mã phòng</p>
    <div class="code" aria-label="Mã phòng">····</div>
    <p class="status">Đang tạo phòng…</p>
    <a href="?role=controller">Thiết bị này là điện thoại?</a>`;
  const code = app.querySelector<HTMLElement>(".code")!;
  const status = app.querySelector<HTMLElement>(".status")!;
  const say = (text: string, tone = "") => {
    status.textContent = text;
    status.className = `status ${tone}`;
  };

  connect({
    onOpen: (conn) => conn.send({ type: "create-room" }),
    onMessage(msg) {
      if (msg.type === "room-created") {
        code.textContent = msg.code;
        say("Đang chờ điện thoại…");
      } else if (msg.type === "peer-joined") {
        say("Điện thoại đã kết nối", "ok");
      } else if (msg.type === "peer-left") {
        say("Điện thoại đã mất kết nối. Nhập lại mã phòng để vào lại.", "bad");
      }
    },
    onClose() {
      code.textContent = "····";
      say("Mất kết nối tới server. Tải lại trang để tạo phòng mới.", "bad");
    },
  });
}
