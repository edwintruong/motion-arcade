import { ROOM_CODE_LENGTH, type ErrorReason } from "../../shared/protocol";
import type { ControllerMsg, HostMsg } from "../../shared/messages";
import type { SwingKind } from "../../shared/gestures/swing";
import { connect, type Connection } from "../connection";
import { Sensors } from "./sensors";

const ERRORS: Partial<Record<ErrorReason, string>> = {
  "room-not-found": "Không tìm thấy phòng. Kiểm tra lại mã trên máy tính.",
  "room-full": "Phòng này đã đủ điện thoại.",
  "bad-message": "Có lỗi xảy ra. Thử lại nhé.",
};
const KIND_NAMES: Record<SwingKind, string> = {
  forehand: "Thuận tay",
  backhand: "Trái tay",
  lob: "Lốp",
  smash: "Đập",
};

/** The phone: pairs with a room code, then becomes a motion controller. */
export function showController(app: HTMLElement) {
  app.className = "controller";
  app.innerHTML = `
    <h1>Motion Arcade</h1>
    <form data-screen="join">
      <p>Nhập mã phòng đang hiện trên máy tính</p>
      <input name="code" maxlength="${ROOM_CODE_LENGTH}" autocomplete="off"
        autocapitalize="characters" spellcheck="false" aria-label="Mã phòng" />
      <button disabled>Vào phòng</button>
    </form>
    <section data-screen="enable" hidden>
      <p>Điện thoại sẽ là cây vợt của bạn.</p>
      <ol class="howto">
        <li>Cầm điện thoại như cán vợt, màn hình hướng sang bên, nắm thật chắc.</li>
        <li>Chĩa đầu điện thoại vào màn hình máy tính rồi bấm <b>Căn chỉnh</b>.</li>
        <li>Vung ngang để đánh, hất lên để lốp, chém xuống để đập.</li>
        <li>Đứng xa người và đồ vật xung quanh.</li>
      </ol>
      <button data-act="enable">Bật cảm biến chuyển động</button>
    </section>
    <section data-screen="play" hidden>
      <p class="seat"></p>
      <p class="say"></p>
      <p class="last"></p>
      <button data-act="calibrate">Căn chỉnh<small>Chĩa điện thoại vào màn hình rồi bấm</small></button>
      <button data-act="hand" class="quiet"></button>
    </section>
    <section data-screen="fallback" hidden>
      <p class="say"></p>
      <p class="why"></p>
      <div class="pads">
        <button data-swing="forehand">Thuận tay</button>
        <button data-swing="backhand">Trái tay</button>
        <button data-swing="lob">Lốp</button>
        <button data-swing="smash">Đập</button>
      </div>
    </section>
    <p class="status">Đang kết nối…</p>`;

  const $ = <T extends HTMLElement>(sel: string) => app.querySelector<T>(sel)!;
  const form = $<HTMLFormElement>("form");
  const input = $<HTMLInputElement>("input");
  const joinButton = $<HTMLButtonElement>("form button");
  const status = $(".status");
  const say = (text: string, tone = "") => {
    status.textContent = text;
    status.className = `status ${tone}`;
  };
  const show = (screen: string) => {
    for (const el of app.querySelectorAll<HTMLElement>("[data-screen]"))
      el.hidden = el.dataset.screen !== screen;
  };

  let conn: Connection | undefined;
  let online = false;
  /** Where to return to after a reconnect: survives a page reload. */
  let seat = JSON.parse(sessionStorage.getItem("seat") ?? "null") as
    | { code: string; slot: number }
    | null;
  /** Which screen the phone is on once paired. */
  let paired: "enable" | "play" | "fallback" = "enable";
  const toHost = (data: ControllerMsg) => conn?.send({ type: "to-host", data });

  const sensors = new Sensors({
    onOrientation: (q) => toHost({ k: "o", q }),
    onSwing(swing) {
      toHost({ k: "swing", ...swing });
      navigator.vibrate?.(25);
      $(".last").textContent =
        `${KIND_NAMES[swing.kind]} · lực ${Math.round(swing.power * 100)}%`;
    },
  });

  // --- pairing -----------------------------------------------------------
  const refresh = () => {
    joinButton.disabled =
      !online || input.value.trim().length !== ROOM_CODE_LENGTH;
  };
  input.addEventListener("input", refresh);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (joinButton.disabled) return;
    say("Đang vào phòng…");
    conn!.send({ type: "join-room", code: input.value });
  });

  // --- sensors -----------------------------------------------------------
  let wakeLock: { release(): Promise<void> } | undefined;
  const keepAwake = async () => {
    try {
      wakeLock = await (navigator as any).wakeLock?.request("screen");
    } catch {}
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && paired !== "enable") keepAwake();
  });

  $("[data-act=enable]").addEventListener("click", async () => {
    say("Đang bật cảm biến…");
    const result = await sensors.start();
    keepAwake();
    if (result === "ok") {
      paired = "play";
    } else {
      paired = "fallback";
      $(".why").textContent =
        result === "denied"
          ? "Bạn chưa cho phép cảm biến chuyển động. Tải lại trang và chọn Cho phép (trên iPhone: Cài đặt → Safari → Chuyển động & Hướng). Tạm thời dùng các nút bên dưới."
          : "Thiết bị này không có cảm biến chuyển động, hoặc trang chưa chạy trên HTTPS. Tạm thời dùng các nút bên dưới.";
    }
    show(paired);
    say("");
  });
  $("[data-act=calibrate]").addEventListener("click", () => {
    sensors.calibrate();
    navigator.vibrate?.(15);
  });

  let leftHanded = localStorage.getItem("leftHanded") === "1";
  const handButton = $("[data-act=hand]");
  const applyHand = () => {
    sensors.setLeftHanded(leftHanded);
    handButton.textContent = leftHanded
      ? "Đang cầm tay trái · đổi sang tay phải"
      : "Đang cầm tay phải · đổi sang tay trái";
  };
  handButton.addEventListener("click", () => {
    leftHanded = !leftHanded;
    localStorage.setItem("leftHanded", leftHanded ? "1" : "0");
    applyHand();
  });
  applyHand();

  for (const pad of app.querySelectorAll<HTMLElement>("[data-swing]"))
    pad.addEventListener("click", () =>
      toHost({ k: "swing", power: 0.6, kind: pad.dataset.swing as SwingKind }),
    );

  // --- network -----------------------------------------------------------
  conn = connect({
    onOpen(c) {
      online = true;
      if (seat) c.send({ type: "join-room", ...seat });
      else say("");
      refresh();
    },
    onMessage(msg) {
      if (msg.type === "room-joined") {
        seat = { code: msg.code, slot: msg.slot };
        sessionStorage.setItem("seat", JSON.stringify(seat));
        show(paired);
        $(".seat").textContent = `Bạn là Người chơi ${msg.slot + 1}`;
        say(`Đã kết nối phòng ${msg.code}`, "ok");
      } else if (msg.type === "peer-left") {
        // The computer closed the room.
        seat = null;
        sessionStorage.removeItem("seat");
        show("join");
        say("Máy tính đã rời phòng. Nhập mã phòng mới.", "bad");
      } else if (msg.type === "error") {
        if (seat) {
          // The room we tried to return to is gone.
          seat = null;
          sessionStorage.removeItem("seat");
          show("join");
        }
        say(ERRORS[msg.reason] ?? "Có lỗi xảy ra. Thử lại nhé.", "bad");
        input.select();
      } else if (msg.type === "from-host") {
        const data = msg.data as HostMsg;
        if (data.k === "ping") toHost({ k: "pong", t: data.t });
        else if (data.k === "buzz") navigator.vibrate?.(data.ms);
        else if (data.k === "say")
          for (const el of app.querySelectorAll(".say")) el.textContent = data.text;
      }
    },
    onClose() {
      online = false;
      refresh();
      say("Mất kết nối. Đang nối lại…", "bad");
    },
  });
}
