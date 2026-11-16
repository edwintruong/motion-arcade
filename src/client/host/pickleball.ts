import { AiPlayer, AI_LEVELS, type AiLevel } from "../../games/pickleball/ai";
import { COURT, other, type Side } from "../../games/pickleball/court";
import { Match, type MatchEvent, type Reason, type Swing } from "../../games/pickleball/match";
import type { Quat } from "../../shared/quat";
import { sounds } from "./audio";
import type { Stage } from "./stage";

export type PlayMode =
  | { kind: "practice" }
  | { kind: "ai"; level: AiLevel }
  | { kind: "local2" };

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
    stage.showCourt(mode.kind === "local2" ? "side" : "behind-0");
    this.match = new Match({
      mode: mode.kind === "practice" ? "practice" : "match",
      speeds: [5, mode.kind === "ai" ? AI_LEVELS[mode.level].speed : 5],
    });
    if (mode.kind === "ai") this.ai = new AiPlayer(1, mode.level);

    hud.innerHTML = `
      <div class="scoreboard"></div>
      <div class="banner"></div>
      <div class="result" hidden><h2></h2><p>Vung vợt để chơi lại</p></div>`;
    this.el = hud;
    this.drawScore();
    if (mode.kind === "practice") {
      this.banner("Máy sẽ phát bóng. Vung khi bóng tới!");
      phones.say(undefined, "Vung khi bóng tới!");
    }
  }

  // ---- input --------------------------------------------------------------

  private sideOf(slot: number): Side {
    return this.mode.kind === "local2" ? (slot as Side) : 0;
  }

  /** The phone slot playing `side`, or undefined for "every phone" / nobody. */
  private slotOf(side: Side): number | undefined {
    return this.mode.kind === "local2" ? side : undefined;
  }

  private isHuman(side: Side) {
    return this.mode.kind === "local2" || side === 0;
  }

  onSwing(slot: number, swing: Swing) {
    if (this.paused) return;
    if (this.match.state.phase === "match-over") {
      if (this.overFor > 1.5) this.restart();
      return;
    }
    this.match.swing(this.sideOf(slot), swing);
  }

  onOrientation(slot: number, q: Quat) {
    this.paddles[this.sideOf(slot)] = q;
  }

  setPaused(paused: boolean) {
    this.paused = paused;
  }

  private restart() {
    this.match.restart();
    this.el.querySelector<HTMLElement>(".result")!.hidden = true;
    this.drawScore();
  }

  // ---- every frame --------------------------------------------------------

  update(dt: number) {
    const s = this.match.state;
    if (!this.paused) {
      if (s.phase === "match-over") this.overFor += dt;
      this.ai?.update(this.match, dt);
      for (const event of this.match.step(dt)) this.on(event);
    }
    this.stage.drawCourt(
      { ball: s.ball.p, players: s.players, paddles: this.paddles, solo: this.mode.kind === "practice" },
      dt,
    );
  }

  private name(side: Side) {
    if (this.mode.kind === "local2") return `Người chơi ${side + 1}`;
    return side === 0 ? "Bạn" : "Máy";
  }

  private on(e: MatchEvent) {
    switch (e.type) {
      case "serve-ready":
        if (this.mode.kind === "practice") return;
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
        return;
      case "whiff":
        sounds.swoosh(0.3);
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
        (e.winner === 0 || this.mode.kind === "local2" ? sounds.point : sounds.fault)();
        if (this.isHuman(loser)) this.phones.buzz(this.slotOf(loser), 120);
        this.drawScore();
        return;
      }
      case "match-over": {
        this.overFor = 0;
        sounds.win();
        const result = this.el.querySelector<HTMLElement>(".result")!;
        result.hidden = false;
        result.querySelector("h2")!.textContent =
          this.mode.kind === "ai" && e.winner === 1 ? "Máy thắng" : `${this.name(e.winner)} thắng!`;
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
