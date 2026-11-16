import type { Side } from "./court";
import { zSign } from "./court";
import type { Match } from "./match";

export type AiLevel = "easy" | "normal" | "hard";

export const AI_LEVELS: Record<
  AiLevel,
  {
    /** Running speed, metres/second (pass it to the match's `speeds`). */
    speed: number;
    /** Chance of simply not getting a racket on a slow ball. */
    miss: number;
    /** Extra chance of missing per metre/second of ball speed above a rally pace. */
    missPerSpeed: number;
    /** How far off perfect timing its swings land (0 = always perfect). */
    jitter: number;
    power: [number, number];
  }
> = {
  easy: { speed: 3.4, miss: 0.2, missPerSpeed: 0.05, jitter: 1.0, power: [0.25, 0.55] },
  normal: { speed: 4.2, miss: 0.08, missPerSpeed: 0.04, jitter: 0.7, power: [0.35, 0.75] },
  hard: { speed: 5, miss: 0.02, missPerSpeed: 0.02, jitter: 0.4, power: [0.45, 0.85] },
};

const RALLY_PACE = 7;

/** A computer opponent: decides when to swing; the match moves it around. */
export class AiPlayer {
  /** What it intends to do with the ball currently coming at it. */
  private plan?: { shot: number; skip: boolean; timing: number; power: number; lob: boolean };
  private serveWait = 0;

  constructor(
    private side: Side,
    private level: AiLevel,
    private rng: () => number = Math.random,
  ) {}

  update(match: Match, dt: number) {
    const s = match.state;
    const cfg = AI_LEVELS[this.level];
    const between = (lo: number, hi: number) => lo + (hi - lo) * this.rng();

    if (s.phase === "serve") {
      this.plan = undefined; // a new rally: shot numbers start again
      if (s.score.server !== this.side) return;
      this.serveWait += dt;
      if (this.serveWait >= 1.6) {
        this.serveWait = 0;
        match.swing(this.side, { power: between(0.35, 0.8), kind: "forehand" });
      }
      return;
    }
    this.serveWait = 0;
    if (s.phase !== "rally" || s.lastHitter === this.side || s.lastHitter === null) return;

    if (this.plan?.shot !== s.shots) {
      const speed = Math.hypot(s.ball.v[0], s.ball.v[2]);
      const miss = cfg.miss + Math.max(0, speed - RALLY_PACE) * cfg.missPerSpeed;
      this.plan = {
        shot: s.shots,
        skip: this.rng() < miss,
        timing: between(-cfg.jitter, cfg.jitter),
        power: between(...cfg.power),
        lob: this.rng() < 0.1,
      };
    }
    // It always lets the ball bounce, so it never volleys illegally.
    if (this.plan.skip || s.bounces < 1) return;
    const aim = match.aim(this.side);
    if (!aim.inReach || aim.timing > this.plan.timing) return;

    const me = s.players[this.side];
    const onForehand = (s.ball.p[0] - me.x) * zSign(this.side) >= 0;
    match.swing(this.side, {
      power: this.plan.power,
      kind: this.plan.lob ? "lob" : onForehand ? "forehand" : "backhand",
    });
  }
}
