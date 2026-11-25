import type { AiLevel } from "../../games/pickleball/ai";
import { parseControllerMsg, type ControllerMsg, type HostMsg } from "../../shared/messages";
import type { SwingKind } from "../../shared/gestures/swing";
import { connect } from "../connection";
import { sounds, unlockAudio } from "./audio";
import { PickleballSession, type PlayMode } from "./pickleball";
import { Stage } from "./stage";
import { mountCharacterPicker } from "./character-picker";
import { characterDesign, isCharacterId } from "../../shared/characters";

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
        <span class="eyebrow">MOTION ARCADE · PLAY TOGETHER</span>
        <h1>Pickle Garden<span>Một chút vận động.<br>Một ngày vui hơn.</span></h1>
        <p>Mở <strong>${location.host}</strong> trên điện thoại rồi nhập mã phòng</p>
        <div class="code" aria-label="Mã phòng">····</div>
        <p class="status">Đang tạo phòng…</p>
      </header>
      <div class="phones"></div>
      <nav class="menu" aria-label="Chọn chế độ chơi">
        <span class="eyebrow">HẸN NHAU TRÊN SÂN</span><h2>Chơi một ván nhé?</h2>
        <section class="character-picker" aria-label="Chọn nhân vật"></section>
        <button data-mode="practice">Vào sân tập<small>Làm quen với vợt, tìm nhịp của bạn</small></button>
        <div class="group">
          <span>Đấu với máy</span>
          <button data-mode="ai" data-level="easy">Dễ</button>
          <button data-mode="ai" data-level="normal">Vừa</button>
          <button data-mode="ai" data-level="hard">Khó</button>
        </div>
        <button data-mode="local2">Hai người chung màn hình</button>
        <div class="group online">
          <span>Đấu online với bạn ở nơi khác</span>
          <button data-mode="online-create">Tạo trận</button>
          <input class="match-code" maxlength="4" autocomplete="off" spellcheck="false"
            placeholder="Mã của bạn bè" aria-label="Mã phòng của bạn bè" />
          <button data-mode="online-join">Vào trận</button>
        </div>
        <p class="online-status"></p>
        <p class="hint"></p>
      </nav>
      <a href="?role=controller">Thiết bị này là điện thoại?</a>
    </div>
    <div class="overlay game" hidden>
      <div class="topbar">
        <button class="quiet" data-act="menu">Về vườn</button>
        <span class="lineup" aria-label="Nhân vật trong trận"></span>
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
  const picker = mountCharacterPicker($(".character-picker"), id => stage.previewCharacter(id));
  let matchCharacters: [string, string] = picker.getSelection();
  function showLineup() {
    $(".lineup").textContent = matchCharacters.map(id => characterDesign(id).name).join(" · ");
    $(".lineup").dataset.characters = matchCharacters.join(",");
  }
  const phones: Phone[] = [];
  let session: PickleballSession | undefined;
  let mode: PlayMode | undefined;
  /** Online: this computer has opened its room to a challenger. */
  let waiting = false;
  const onlineStatus = (text: string) => ($(".online-status").textContent = text);
  const setWaiting = (next: boolean) => {
    waiting = next;
    $("[data-mode=online-create]").textContent = waiting ? "Huỷ chờ" : "Tạo trận";
    onlineStatus(
      waiting ? `Đang chờ đối thủ. Gửi mã phòng ${code.textContent} cho bạn bè để họ bấm Vào trận.` : "",
    );
  };
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
    $(".hint").textContent = !slots.length
      ? "Kết nối điện thoại để bắt đầu."
      : slots.length < 2
        ? "Muốn chơi hai người: điện thoại thứ hai nhập cùng mã phòng."
        : "Đã đủ hai điện thoại.";
    updatePause();
  }

  const neededPhones = (kind: string) => (kind === "local2" ? 2 : 1);

  // ---- starting and leaving a game ----------------------------------------

  function start(next: PlayMode) {
    setWaiting(false);
    mode = next;
    stage.hideLobby();
    $(".lobby").hidden = true;
    $(".game").hidden = false;
    session = new PickleballSession(stage, $(".hud"), next, {
      say: (slot, text) => toPhones({ k: "say", text }, slot),
      buzz: (slot, ms) => toPhones({ k: "buzz", ms }, slot),
    });
    const chosen = picker.getSelection();
    matchCharacters = next.kind === "online" && next.side === 1 ? [chosen[1], chosen[0]] : chosen;
    matchCharacters.forEach((id, side) => stage.setCharacter(side, id));
    showLineup();
    if (next.kind === "online") conn.send({ type: "to-opponent", data: { k: "character", id: chosen[0] } });
    updatePause();
  }

  function toMenu() {
    if (mode?.kind === "online") conn.send({ type: "leave-match" });
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
    const slots = connectedSlots();
    // Two-player games need both seats; the others just need somebody.
    const absent = mode.kind === "local2" ? [0, 1].filter((s) => !slots.includes(s)) : [];
    const missing = mode.kind === "local2" ? absent.length > 0 : slots.length === 0;
    session.setPaused(missing);
    $(".paused").hidden = !missing;
    const who = absent.length ? `của Người chơi ${absent.map((s) => s + 1).join(" và ")} ` : "";
    $(".paused p").textContent =
      `Điện thoại ${who}mất kết nối. Đang chờ nối lại… Nếu cần, nhập lại mã phòng ${code.textContent}.`;
  }

  app.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-mode],[data-act]");
    if (!target || (target as HTMLButtonElement).disabled) return;
    if (target.dataset.act === "menu") toMenu();
    else if (target.dataset.mode === "practice") start({ kind: "practice" });
    else if (target.dataset.mode === "local2") start({ kind: "local2" });
    else if (target.dataset.mode === "online-create") setWaiting(!waiting);
    else if (target.dataset.mode === "online-join") {
      onlineStatus("Đang vào trận…");
      conn.send({ type: "join-match", code: $<HTMLInputElement>(".match-code").value });
    }
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
    } else if (msg.k === "move") {
      session?.onMove(slot, msg.x, msg.y);
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

  const startOnline = (side: 0 | 1) =>
    start({ kind: "online", side, send: (data) => conn.send({ type: "to-opponent", data }) });

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
      } else if (msg.type === "opponent-joined") {
        // Whoever opened the match plays the near side; a challenge nobody asked for is declined.
        if (waiting && !session) startOnline(0);
        else conn.send({ type: "leave-match" });
      } else if (msg.type === "match-joined") {
        if (!session) startOnline(1);
      } else if (msg.type === "opponent-left") {
        if (mode?.kind === "online") {
          toMenu();
          onlineStatus("Đối thủ đã rời trận hoặc chưa sẵn sàng.");
        }
      } else if (msg.type === "from-opponent") {
        if (mode?.kind === "online") {
          const data = msg.data as { k?: unknown; id?: unknown } | null;
          if (data && (data.k === "character" || data.k === "character-reply")) {
            if (isCharacterId(data.id)) {
              const opponent = mode.side === 0 ? 1 : 0;
              matchCharacters[opponent] = data.id;
              stage.setCharacter(opponent, data.id);
              showLineup();
              // Reply handles either peer entering the match first, without a loop.
              if (data.k === "character") conn.send({ type: "to-opponent", data: { k: "character-reply", id: matchCharacters[mode.side] } });
            }
          } else session?.onRemote(msg.data);
        }
      } else if (msg.type === "error") {
        if (msg.reason === "match-not-found") onlineStatus("Không tìm thấy trận với mã này.");
        else if (msg.reason === "match-full") onlineStatus("Trận này đã đủ hai người.");
      } else if (msg.type === "from-controller") {
        const data = parseControllerMsg(msg.data);
        if (data) onController(msg.slot, data);
      }
    },
    onClose() {
      code.textContent = "····";
      if (mode?.kind === "online") toMenu();
      setWaiting(false);
      phones.length = 0;
      renderLobby();
      say(
        navigator.onLine
          ? "Mất kết nối tới server. Đang nối lại…"
          : "Không có mạng. Cần mạng để ghép điện thoại; game sẽ tự nối lại khi có mạng.",
        "bad",
      );
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
