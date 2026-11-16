import { ROOM_CODE_LENGTH, type ErrorReason } from "../shared/protocol";
import { connect, type Connection } from "./connection";

const ERRORS: Record<ErrorReason, string> = {
  "room-not-found": "Không tìm thấy phòng. Kiểm tra lại mã trên máy tính.",
  "room-full": "Phòng này đã có điện thoại khác kết nối.",
  "bad-message": "Có lỗi xảy ra. Thử lại nhé.",
};

/** The phone: types a room code to pair with the computer showing it. */
export function showController(app: HTMLElement) {
  app.innerHTML = `
    <h1>Motion Arcade</h1>
    <form>
      <p>Nhập mã phòng đang hiện trên máy tính</p>
      <input name="code" maxlength="${ROOM_CODE_LENGTH}" autocomplete="off"
        autocapitalize="characters" spellcheck="false" aria-label="Mã phòng" />
      <button disabled>Vào phòng</button>
    </form>
    <p class="status">Đang kết nối…</p>
    <a href="?role=host">Thiết bị này là máy tính?</a>`;
  const form = app.querySelector("form")!;
  const input = app.querySelector("input")!;
  const button = app.querySelector("button")!;
  const status = app.querySelector<HTMLElement>(".status")!;
  const say = (text: string, tone = "") => {
    status.textContent = text;
    status.className = `status ${tone}`;
  };

  let conn: Connection | undefined;
  const refresh = () => {
    button.disabled = !conn || input.value.trim().length !== ROOM_CODE_LENGTH;
  };
  input.addEventListener("input", refresh);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (button.disabled) return;
    say("Đang vào phòng…");
    conn!.send({ type: "join-room", code: input.value });
  });

  connect({
    onOpen(c) {
      conn = c;
      say("");
      refresh();
    },
    onMessage(msg) {
      if (msg.type === "room-joined") {
        form.hidden = true;
        say(`Đã kết nối phòng ${msg.code}`, "ok");
      } else if (msg.type === "peer-left") {
        form.hidden = false;
        say("Máy tính đã rời phòng. Nhập mã phòng mới.", "bad");
      } else if (msg.type === "error") {
        say(ERRORS[msg.reason], "bad");
        input.select();
      }
    },
    onClose() {
      conn = undefined;
      form.hidden = false;
      refresh();
      say("Mất kết nối tới server. Tải lại trang để thử lại.", "bad");
    },
  });
}
