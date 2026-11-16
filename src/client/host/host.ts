import { parseControllerMsg, type ControllerMsg, type HostMsg } from "../../shared/messages";
import type { SwingKind } from "../../shared/gestures/swing";
import { connect } from "../connection";
import { sounds, unlockAudio } from "./audio";
import { Stage } from "./stage";

const KIND_NAMES: Record<SwingKind, string> = {
  forehand: "Thuận tay",
  backhand: "Trái tay",
  lob: "Lốp",
  smash: "Đập",
};

interface Phone {
  connected: boolean;
  /** One-way delay estimate, milliseconds. */
  latency?: number;
  /** Orientation messages received in the last second. */
  rate: number;
  count: number;
}

/** The computer: owns the room, the 3D picture and the game being played. */
export function showHost(app: HTMLElement) {
  app.className = "host";
  app.innerHTML = `
    <canvas></canvas>
    <div class="overlay">
      <header>
        <h1>Motion Arcade</h1>
        <p>Mở <strong>${location.host}</strong> trên điện thoại rồi nhập mã phòng</p>
        <div class="code" aria-label="Mã phòng">····</div>
        <p class="status">Đang tạo phòng…</p>
      </header>
      <div class="phones"></div>
      <a href="?role=controller">Thiết bị này là điện thoại?</a>
    </div>`;
  const $ = <T extends HTMLElement>(sel: string) => app.querySelector<T>(sel)!;
  const code = $(".code");
  const status = $(".status");
  const phonesEl = $(".phones");
  const say = (text: string, tone = "") => {
    status.textContent = text;
    status.className = `status ${tone}`;
  };
  addEventListener("pointerdown", unlockAudio);
  addEventListener("keydown", unlockAudio);

  const stage = new Stage($<HTMLCanvasElement>("canvas"));
  const phones: Phone[] = [];
  const connectedSlots = () =>
    phones.flatMap((p, slot) => (p?.connected ? [slot] : []));

  function renderPhones() {
    stage.showLobby(connectedSlots());
    phonesEl.innerHTML = phones
      .map((p, slot) =>
        p?.connected
          ? `<div class="phone" data-slot="${slot}">
              <strong>Điện thoại ${slot + 1}</strong>
              <span class="stats"></span>
              <div class="power"><i></i></div>
              <span class="swing"></span>
            </div>`
          : "",
      )
      .join("");
    say(
      connectedSlots().length ? "Điện thoại đã kết nối" : "Đang chờ điện thoại…",
      connectedSlots().length ? "ok" : "",
    );
  }

  function onController(slot: number, msg: ControllerMsg) {
    const phone = phones[slot];
    if (!phone) return;
    if (msg.k === "o") {
      phone.count++;
      stage.setLobbyPaddle(slot, msg.q);
    } else if (msg.k === "pong") {
      phone.latency = (performance.now() - msg.t) / 2;
    } else if (msg.k === "swing") {
      sounds.swoosh(msg.power);
      stage.kickLobbyPaddle(slot, msg.power);
      const card = phonesEl.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
      if (card) {
        card.querySelector<HTMLElement>(".power i")!.style.width = `${Math.round(msg.power * 100)}%`;
        card.querySelector(".swing")!.textContent =
          `${KIND_NAMES[msg.kind]} · lực ${Math.round(msg.power * 100)}%`;
      }
    }
  }

  const conn = connect({
    onOpen: (c) => c.send({ type: "create-room" }),
    onMessage(msg) {
      if (msg.type === "room-created") {
        code.textContent = msg.code;
        phones.length = 0;
        renderPhones();
      } else if (msg.type === "peer-joined") {
        phones[msg.slot] = { connected: true, rate: 0, count: 0 };
        renderPhones();
      } else if (msg.type === "peer-left") {
        if (phones[msg.slot]) phones[msg.slot].connected = false;
        renderPhones();
      } else if (msg.type === "from-controller") {
        const data = parseControllerMsg(msg.data);
        if (data) onController(msg.slot, data);
      }
    },
    onClose() {
      code.textContent = "····";
      say("Mất kết nối tới server. Đang nối lại…", "bad");
    },
  });
  const toPhones = (data: HostMsg, slot?: number) =>
    conn.send({ type: "to-controller", slot, data });

  // Once a second: measure delay and how fast orientation is arriving.
  setInterval(() => {
    toPhones({ k: "ping", t: performance.now() });
    phones.forEach((p, slot) => {
      if (!p?.connected) return;
      p.rate = p.count;
      p.count = 0;
      const stats = phonesEl.querySelector(`[data-slot="${slot}"] .stats`);
      if (stats)
        stats.textContent =
          `Độ trễ ~${p.latency === undefined ? "?" : Math.round(p.latency)} ms · ${p.rate} mẫu/giây`;
    });
  }, 1000);

  let last = performance.now();
  const frame = (now: number) => {
    stage.render(Math.min(0.1, (now - last) / 1000));
    last = now;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
