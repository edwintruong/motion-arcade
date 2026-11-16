import type { AiLevel } from "../../games/pickleball/ai";
import { parseControllerMsg, type ControllerMsg, type HostMsg } from "../../shared/messages";
import type { SwingKind } from "../../shared/gestures/swing";
import { connect } from "../connection";
import { sounds, unlockAudio } from "./audio";
import { PickleballSession, type PlayMode } from "./pickleball";
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
    <div class="overlay lobby">
      <header>
        <h1>Motion Arcade</h1>
        <p>Mở <strong>${location.host}</strong> trên điện thoại rồi nhập mã phòng</p>
        <div class="code" aria-label="Mã phòng">····</div>
        <p class="status">Đang tạo phòng…</p>
      </header>
      <div class="phones"></div>
      <nav class="menu" aria-label="Chọn chế độ chơi">
        <h2>Pickleball</h2>
        <button data-mode="practice">Tập đánh</button>
        <div class="group">
          <span>Đấu với máy</span>
          <button data-mode="ai" data-level="easy">Dễ</button>
          <button data-mode="ai" data-level="normal">Vừa</button>
          <button data-mode="ai" data-level="hard">Khó</button>
        </div>
        <p class="hint"></p>
      </nav>
      <a href="?role=controller">Thiết bị này là điện thoại?</a>
    </div>
    <div class="overlay game" hidden>
      <div class="topbar">
        <button class="quiet" data-act="menu">← Menu</button>
        <span class="room"></span>
      </div>
      <div class="hud"></div>
      <div class="paused" hidden>
        <h2>Tạm dừng</h2>
        <p></p>
      </div>
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
  let session: PickleballSession | undefined;
  let mode: PlayMode | undefined;
  const connectedSlots = () =>
    phones.flatMap((p, slot) => (p?.connected ? [slot] : []));

  // ---- lobby ---------------------------------------------------------------

  function renderLobby() {
    const slots = connectedSlots();
    if (!session) stage.showLobby(slots);
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
    say(slots.length ? "Điện thoại đã kết nối" : "Đang chờ điện thoại…", slots.length ? "ok" : "");
    for (const button of app.querySelectorAll<HTMLButtonElement>(".menu [data-mode]"))
      button.disabled = slots.length < neededPhones(button.dataset.mode!);
    $(".hint").textContent = slots.length
      ? "Chọn chế độ bằng chuột. Trong trận, mọi thứ điều khiển bằng cú vung."
      : "Kết nối điện thoại để bắt đầu.";
    updatePause();
  }

  const neededPhones = (kind: string) => (kind === "local2" ? 2 : 1);

  // ---- starting and leaving a game ----------------------------------------

  function start(next: PlayMode) {
    mode = next;
    stage.hideLobby();
    $(".lobby").hidden = true;
    $(".game").hidden = false;
    session = new PickleballSession(stage, $(".hud"), next, {
      say: (slot, text) => toPhones({ k: "say", text }, slot),
      buzz: (slot, ms) => toPhones({ k: "buzz", ms }, slot),
    });
    updatePause();
  }

  function toMenu() {
    session?.dispose();
    session = undefined;
    mode = undefined;
    $(".lobby").hidden = false;
    $(".game").hidden = true;
    toPhones({ k: "say", text: "" });
    renderLobby();
  }

  /** The game waits whenever a phone it needs is missing. */
  function updatePause() {
    if (!session || !mode) return;
    const missing = connectedSlots().length < neededPhones(mode.kind);
    session.setPaused(missing);
    $(".paused").hidden = !missing;
    $(".paused p").textContent =
      `Điện thoại mất kết nối. Đang chờ nối lại… Nếu cần, nhập lại mã phòng ${code.textContent}.`;
  }

  app.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-mode],[data-act]");
    if (!target || (target as HTMLButtonElement).disabled) return;
    if (target.dataset.act === "menu") toMenu();
    else if (target.dataset.mode === "practice") start({ kind: "practice" });
    else if (target.dataset.mode === "ai")
      start({ kind: "ai", level: target.dataset.level as AiLevel });
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && session) toMenu();
  });

  // ---- phones --------------------------------------------------------------

  function onController(slot: number, msg: ControllerMsg) {
    const phone = phones[slot];
    if (!phone) return;
    if (msg.k === "o") {
      phone.count++;
      if (session) session.onOrientation(slot, msg.q);
      else stage.setLobbyPaddle(slot, msg.q);
    } else if (msg.k === "pong") {
      phone.latency = (performance.now() - msg.t) / 2;
    } else if (msg.k === "swing") {
      if (session) return session.onSwing(slot, msg);
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
        $(".room").textContent = `Phòng ${msg.code}`;
        phones.length = 0;
        renderLobby();
      } else if (msg.type === "peer-joined") {
        phones[msg.slot] = { connected: true, rate: 0, count: 0 };
        renderLobby();
      } else if (msg.type === "peer-left") {
        if (phones[msg.slot]) phones[msg.slot].connected = false;
        renderLobby();
      } else if (msg.type === "from-controller") {
        const data = parseControllerMsg(msg.data);
        if (data) onController(msg.slot, data);
      }
    },
    onClose() {
      code.textContent = "····";
      phones.length = 0;
      renderLobby();
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
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    session?.update(dt);
    stage.render(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
