import { AiPlayer, AI_LEVELS, type AiLevel } from "../../games/pickleball/ai";
import { COURT, other, type Side } from "../../games/pickleball/court";
import { Match, type MatchEvent, type Reason, type Swing } from "../../games/pickleball/match";
import { applyWire, toWire, type Wire } from "../../games/pickleball/netplay";
import type { Quat } from "../../shared/quat";
import { sounds } from "./audio";
import type { Stage } from "./stage";

export type PlayMode =
  | { kind: "practice" }
  | { kind: "ai"; level: AiLevel }
  | { kind: "local2" }
  /** Against another computer; `side` is the one played here. */
  | { kind: "online"; side: Side; send: (wire: Wire) => void };

/** How the session reaches the phones. */
export interface PhoneLink {
  say(slot: number | undefined, text: string): void;
  buzz(slot: number | undefined, ms: number): void;
}

const LEVEL_NAMES: Record<AiLevel, string> = { easy: "Dễ", normal: "Vừa", hard: "Khó" };
const REASONS: Record<Reason, string> = {
  out: "đánh bóng ra ngoài",
  net: "đánh bóng vào lưới",
  "double-bounce": "không đỡ được bóng",
  "two-bounce-rule": "phạm luật: phải để bóng nảy rồi mới đánh",
  kitchen: "phạm luật: vô-lê trong vùng cấm",
};

let courtBuilt = false;

/** One sitting of pickleball on the computer: match, picture, sound, scoreboard. */
export class PickleballSession {
  private match: Match;
  private ai?: AiPlayer;
  private paddles: (Quat | undefined)[] = [];
  private paused = false;
  private overFor = 0;
  private practice = { hits: 0, good: 0 };
  private el: HTMLElement;
  private queued: ({ swing: Swing; remaining: number } | undefined)[] = [];
  private networkClock = 0;
  private cue = ["", ""];
  private feedbackFor = [0, 0];

  constructor(
    private stage: Stage,
    hud: HTMLElement,
    private mode: PlayMode,
    private phones: PhoneLink,
  ) {
    if (!courtBuilt) {
      stage.buildCourt(COURT);
      courtBuilt = true;
    }
    stage.showCourt(
      mode.kind === "local2" ? "side" : mode.kind === "online" && mode.side === 1 ? "behind-1" : "behind-0",
    );
    this.match = new Match({
      mode: mode.kind === "practice" ? "practice" : "match",
      speeds: [5, mode.kind === "ai" ? AI_LEVELS[mode.level].speed : 5],
      owns: mode.kind === "online" ? (side) => side === mode.side : undefined,
    });
    if (mode.kind === "ai") this.ai = new AiPlayer(1, mode.level);

    hud.innerHTML = `
      <div class="scoreboard"></div>
      <div class="banner"></div>
      <div class="play-guide">Hướng điện thoại để di chuyển · Về tư thế căn chỉnh để tự đón bóng · Vung nhanh/chậm để chọn lực</div>
      <div class="hit-cue" aria-live="polite"></div>
      <div class="result" hidden><h2></h2><p>Vung vợt để chơi lại</p></div>`;
    this.el = hud;
    this.drawScore();
    if (mode.kind === "practice") {
      this.banner("Máy sẽ phát bóng. Vung khi bóng tới!");
      phones.say(undefined, "Vung khi bóng tới!");
      this.feedbackFor[0] = 1.3;
    }
  }

  // ---- input --------------------------------------------------------------

  private sideOf(slot: number): Side {
    if (this.mode.kind === "online") return this.mode.side;
    return this.mode.kind === "local2" ? (slot as Side) : 0;
  }

  /** The phone slot playing `side`, or undefined for "every phone" / nobody. */
  private slotOf(side: Side): number | undefined {
    return this.mode.kind === "local2" ? side : undefined;
  }

  /** Whether `side` is played by someone holding a phone at this computer. */
  private isHuman(side: Side) {
    if (this.mode.kind === "online") return side === this.mode.side;
    return this.mode.kind === "local2" || side === 0;
  }

  /** Online: a message from the other computer. */
  onRemote(data: unknown) {
    const before = [...this.match.state.ball.p] as [number, number, number];
    if (!applyWire(this.match, data)) return;
    const after = this.match.state.ball.p;
    // The opponent's hit moves the ball to where they really struck it.
    if (Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]) > 0.05)
      this.stage.smoothBallFrom(before, after);
  }

  onSwing(slot: number, swing: Swing) {
    if (this.paused) return;
    if (this.match.state.phase === "match-over") {
      if (this.overFor > 1.5) this.restart();
      return;
    }
    const side = this.sideOf(slot);
    // A small early-input window helps with phone/network latency, without auto-hitting.
    if (this.match.canHit(side)) this.match.swing(side, swing);
    else this.queued[side] = { swing, remaining: 0.18 };
  }

  onMove(slot: number, x: number, y: number) {
    if (!this.paused) this.match.move(this.sideOf(slot), x, y);
  }

  onOrientation(slot: number, q: Quat) {
    this.paddles[this.sideOf(slot)] = q;
  }

  setPaused(paused: boolean) {
    // An online match cannot stop for one side; the other player is still playing.
    this.paused = paused && this.mode.kind !== "online";
    if (paused) {
      this.queued = [];
      for (const side of [0, 1] as Side[]) this.match.move(side, 0, 0);
    }
  }

  private restart() {
    this.queued = [];
    this.match.restart();
    if (this.mode.kind === "online") this.mode.send({ k: "rematch" });
  }

  // ---- every frame --------------------------------------------------------

  update(dt: number) {
    const s = this.match.state;
    if (!this.paused) {
      if (s.phase === "match-over") this.overFor += dt;
      this.ai?.update(this.match, dt);
      for (const side of [0, 1] as Side[]) {
        const queued = this.queued[side];
        if (!queued) continue;
        queued.remaining -= dt;
        if (this.match.canHit(side) || queued.remaining <= 0) {
          this.match.swing(side, queued.swing);
          this.queued[side] = undefined;
        }
      }
      for (const event of this.match.step(dt)) {
        if (this.mode.kind === "online") {
          const wire = toWire(event);
          if (wire) this.mode.send(wire);
        }
        this.on(event);
      }
      this.networkClock += dt;
      if (this.mode.kind === "online" && this.networkClock >= 0.1) {
        this.networkClock = 0;
        const { x, z } = s.players[this.mode.side];
        this.mode.send({ k: "player", side: this.mode.side, x, z });
      }
      const hints: string[] = [];
      for (const side of [0, 1] as Side[]) {
        if (!this.isHuman(side)) continue;
        this.feedbackFor[side] = Math.max(0, this.feedbackFor[side] - dt);
        const ready = this.match.canHit(side);
        const text = ready ? (s.phase === "serve" ? "Đánh để giao bóng" : "Đánh ngay!") :
          s.phase === "rally" ? (s.lastHitter === side ? "Về vị trí · chuẩn bị đỡ" : "Đón bóng · chờ bóng tới") : "Chuẩn bị ván tiếp theo";
        hints.push(`${this.mode.kind === "local2" ? this.name(side) + ": " : ""}${text}`);
        if (text !== this.cue[side] && this.feedbackFor[side] === 0) {
          this.cue[side] = text;
          this.phones.say(this.slotOf(side), text);
        }
      }
      const hint = this.el.querySelector<HTMLElement>(".hit-cue")!;
      const hintText = hints.join(" · ");
      if (hint.textContent !== hintText) hint.textContent = hintText;
      hint.classList.toggle("ready", ([0, 1] as Side[]).some(side => this.isHuman(side) && this.match.canHit(side)));
    }
    this.el.querySelector<HTMLElement>(".result")!.hidden = s.phase !== "match-over";
    this.stage.drawCourt(
      { ball: s.ball.p, players: s.players, paddles: this.paddles, solo: this.mode.kind === "practice" },
      dt,
    );
  }

  private name(side: Side) {
    if (this.mode.kind === "local2") return `Người chơi ${side + 1}`;
    if (this.mode.kind === "online") return side === this.mode.side ? "Bạn" : "Đối thủ";
    return side === 0 ? "Bạn" : "Máy";
  }

  private on(e: MatchEvent) {
    switch (e.type) {
      case "serve-ready":
        this.drawScore();
        if (this.mode.kind === "practice") return;
        this.feedbackFor = [0.9, 0.9];
        this.cue = ["", ""];
        this.banner(
          this.isHuman(e.server)
            ? `${this.name(e.server)} giao bóng: vung để giao`
            : `${this.name(e.server)} giao bóng`,
        );
        for (const side of [0, 1] as Side[])
          if (this.isHuman(side))
            this.phones.say(
              this.slotOf(side),
              side === e.server ? "Vung để giao bóng" : "Chuẩn bị đỡ bóng",
            );
        return;
      case "hit":
        sounds.hit(e.power);
        if (this.isHuman(e.side) && !(this.mode.kind === "practice" && e.side === 1))
          this.phones.buzz(this.slotOf(e.side), 40);
        if (this.mode.kind === "practice" && e.side === 0) this.practice.hits++;
        if (e.shot > 1) this.banner("");
        if (this.isHuman(e.side)) {
          this.feedbackFor[e.side] = 0.7;
          this.cue[e.side] = "";
          this.phones.say(this.slotOf(e.side), `Đánh trúng · lực ${Math.round(e.power * 100)}%`);
        }
        return;
      case "whiff":
        sounds.swoosh(0.3);
        if (this.isHuman(e.side)) {
          this.feedbackFor[e.side] = 0.7;
          this.cue[e.side] = "";
          this.phones.say(this.slotOf(e.side), "Chưa tới bóng · chờ tín hiệu Đánh ngay!");
        }
        return;
      case "bounce":
        sounds.bounce();
        return;
      case "net":
        sounds.net();
        return;
      case "rally-over": {
        const loser = other(e.winner);
        if (this.mode.kind === "practice") {
          if (e.winner === 0) this.practice.good++;
          this.banner(e.winner === 0 ? "Bóng vào sân!" : `Bạn ${REASONS[e.reason]}`);
        } else {
          this.banner(`${this.name(loser)} ${REASONS[e.reason]}`);
        }
        (this.isHuman(e.winner) ? sounds.point : sounds.fault)();
        if (this.isHuman(loser)) this.phones.buzz(this.slotOf(loser), 120);
        this.drawScore();
        return;
      }
      case "match-over": {
        this.overFor = 0;
        sounds.win();
        this.el.querySelector(".result h2")!.textContent =
          this.isHuman(e.winner) ? `${this.name(e.winner)} thắng!` : `${this.name(e.winner)} thắng`;
        this.banner("");
        this.phones.say(undefined, "Hết trận. Vung để chơi lại");
        return;
      }
    }
  }

  private banner(text: string) {
    this.el.querySelector(".banner")!.textContent = text;
  }

  private drawScore() {
    const board = this.el.querySelector(".scoreboard")!;
    if (this.mode.kind === "practice") {
      board.innerHTML = `<span>Tập đánh</span><span>Đánh trúng <b>${this.practice.hits}</b></span><span>Vào sân <b>${this.practice.good}</b></span>`;
      return;
    }
    const { points, server } = this.match.state.score;
    const cell = (side: Side) =>
      `<span class="${server === side ? "serving" : ""}">${this.name(side)}${
        side === 1 && this.mode.kind === "ai" ? ` (${LEVEL_NAMES[this.mode.level]})` : ""
      } <b data-points="${side}">${points[side]}</b></span>`;
    board.innerHTML = cell(0) + cell(1);
  }

  dispose() {
    this.stage.hideCourt();
    this.el.innerHTML = "";
  }
}
