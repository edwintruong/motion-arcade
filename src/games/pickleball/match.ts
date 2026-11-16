import type { SwingKind } from "../../shared/gestures/swing";
import type { Vec3 } from "../../shared/quat";
import { COURT, depthOn, inCourt, inServiceCourt, other, zSign, type Side } from "./court";
import { launchTo, predictLanding, stepBall, type Ball } from "./physics";
import { newScore, rallyWon, servesFromRight, type Score } from "./scoring";

export interface Swing {
  /** 0 to 1. */
  power: number;
  kind: SwingKind;
}

export type Reason = "out" | "net" | "double-bounce" | "two-bounce-rule" | "kitchen";
export type Phase = "serve" | "rally" | "point-over" | "match-over";

export type MatchEvent =
  | { type: "serve-ready"; server: Side }
  | { type: "hit"; side: Side; kind: SwingKind; power: number; ball: Ball; shot: number }
  | { type: "whiff"; side: Side }
  | { type: "bounce"; p: Vec3 }
  | { type: "net" }
  | {
      type: "rally-over";
      winner: Side;
      /** What the losing side did wrong. */
      reason: Reason;
      score: [number, number];
      /** Who serves next. */
      server: Side;
    }
  | { type: "match-over"; winner: Side };

export interface PlayerState {
  x: number;
  z: number;
  /** Seconds since this player last swung, for animation. */
  swingAge: number;
  kind: SwingKind;
}

export interface MatchOptions {
  /** "practice": a machine feeds balls to side 0, nothing is scored. */
  mode: "match" | "practice";
  pointsToWin?: number;
  /** Random numbers in [0, 1); only used to vary practice feeds. */
  rng?: () => number;
  /** Running speed of each player, metres/second. */
  speeds?: [number, number];
  /**
   * Online play: which sides this computer plays. Swings for other sides
   * are ignored here and arrive through `applyRemoteHit`; a rally is only
   * decided on the computer of the player the ball is travelling to.
   */
  owns?: (side: Side) => boolean;
}

const STEP = 1 / 120;
const REACH = 1.6;
/** Distance in front of or behind the player that maps to timing ±1. */
const TIMING_SPAN = 1.2;
const MAX_CONTACT_HEIGHT = 2.7;
const HOME_DEPTH = 5.4;
/** How far behind the bounce a player waits for the ball. */
const STAND_BEHIND = 1.3;
const SERVE_DELAY = 0.9;
const POINT_PAUSE = 2.2;
const FEED_DELAY = 1;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * One game of pickleball singles: ball, players, rules and score.
 * Pure simulation: feed it swings and time, read `state` and events.
 * Players run to the ball by themselves; a swing only decides when.
 */
export class Match {
  readonly state: {
    phase: Phase;
    /** Seconds spent in the current phase. */
    phaseTime: number;
    score: Score;
    ball: Ball;
    lastHitter: Side | null;
    /** Bounces since the last hit. */
    bounces: number;
    /** Hits in the current rally, the serve included. */
    shots: number;
    players: [PlayerState, PlayerState];
    /** Rallies finished so far. */
    rallies: number;
  };
  /** Seconds simulated so far. */
  time = 0;

  private opts: Required<MatchOptions>;
  private events: MatchEvent[] = [];
  private carry = 0;

  constructor(options: MatchOptions) {
    this.opts = {
      pointsToWin: 11,
      rng: Math.random,
      speeds: [5, 5],
      owns: () => true,
      ...options,
    };
    const player = (side: Side): PlayerState => ({
      x: 0,
      z: zSign(side) * HOME_DEPTH,
      swingAge: 9,
      kind: "forehand",
    });
    this.state = {
      phase: "serve",
      phaseTime: 0,
      score: newScore(0),
      ball: { p: [0, 1, 0], v: [0, 0, 0] },
      lastHitter: null,
      bounces: 0,
      shots: 0,
      players: [player(0), player(1)],
      rallies: 0,
    };
    this.startServe();
  }

  restart() {
    this.state.score = newScore(0);
    this.state.rallies = 0;
    this.startServe();
  }

  /** Whether `side` could hit the ball now, and how early (+) or late (-) a swing would be. */
  aim(side: Side): { inReach: boolean; timing: number } {
    const { ball, players, phase, lastHitter } = this.state;
    const me = players[side];
    const inReach =
      phase === "rally" &&
      lastHitter !== side &&
      Math.hypot(ball.p[0] - me.x, ball.p[2] - me.z) <= REACH &&
      ball.p[1] <= MAX_CONTACT_HEIGHT;
    return { inReach, timing: ((me.z - ball.p[2]) * zSign(side)) / TIMING_SPAN };
  }

  swing(side: Side, swing: Swing) {
    const s = this.state;
    if (!this.opts.owns(side)) return;
    if (s.phase === "serve") {
      const mayServe =
        this.opts.mode === "match" && side === s.score.server && s.phaseTime >= SERVE_DELAY;
      if (mayServe) this.serve(side, swing);
      return;
    }
    if (s.phase !== "rally" || s.lastHitter === side) return;
    const me = s.players[side];
    me.swingAge = 0;
    me.kind = swing.kind;

    const aim = this.aim(side);
    if (!aim.inReach) {
      this.events.push({ type: "whiff", side });
      return;
    }
    if (this.opts.mode === "match" && s.bounces === 0) {
      // Volleys: not before the serve and its return have bounced, never from the kitchen.
      if (s.shots <= 2) return this.endRally(other(side), "two-bounce-rule");
      if (Math.abs(me.z) < COURT.kitchen) return this.endRally(other(side), "kitchen");
    }

    const dir = -zSign(side); // towards the opponent
    const power = clamp(swing.power, 0, 1);
    const overhit = Math.max(0, power - 0.9) * 8;
    let depth: number;
    let airtime: number;
    if (swing.kind === "lob") {
      depth = 5 + 1.2 * power + overhit;
      airtime = 1.9;
    } else if (swing.kind === "smash") {
      depth = 4 + 2 * power + overhit;
      airtime = lerp(0.7, 0.5, power);
    } else {
      depth = 3 + 3.2 * power + overhit;
      airtime = lerp(1.35, 0.85, power);
    }
    // Early pulls the ball across the body, late pushes it the other way.
    const across = swing.kind === "backhand" ? 1 : -1;
    const x = clamp(aim.timing, -1.4, 1.4) * 2.3 * across * zSign(side);
    this.launch(side, swing, launchTo(s.ball.p, x, dir * depth, airtime));
  }

  /** Online: the opponent's computer reports their hit. */
  applyRemoteHit(hit: { side: Side; kind: SwingKind; power: number; ball: Ball; shot: number }) {
    const s = this.state;
    s.phase = "rally";
    s.ball = { p: [...hit.ball.p], v: [...hit.ball.v] };
    s.lastHitter = hit.side;
    s.bounces = 0;
    s.shots = hit.shot;
    s.players[hit.side].swingAge = 0;
    s.players[hit.side].kind = hit.kind;
    this.events.push({ type: "hit", ...hit });
  }

  /** Online: the opponent's computer reports how the rally ended. */
  applyRemoteRallyOver(winner: Side, reason: Reason, score: Score) {
    if (this.state.phase === "match-over") return;
    this.finishRally(winner, reason, score);
  }

  /** Advances the simulation; returns everything that happened. */
  step(dt: number): MatchEvent[] {
    this.carry += dt;
    while (this.carry >= STEP - 1e-9) {
      this.carry -= STEP;
      this.tick();
    }
    return this.events.splice(0);
  }

  // ---------------------------------------------------------------------

  private tick() {
    const s = this.state;
    this.time += STEP;
    s.phaseTime += STEP;
    for (const side of [0, 1] as Side[]) {
      s.players[side].swingAge += STEP;
      this.run(side);
    }

    if (s.phase === "serve") {
      this.holdBall();
      if (this.opts.mode === "practice" && s.phaseTime >= FEED_DELAY) this.feed();
      return;
    }
    if (s.phase === "match-over") return;

    const event = stepBall(s.ball, STEP);
    if (event) this.events.push(event);
    if (s.phase === "rally" && event && s.lastHitter !== null) {
      const hitter = s.lastHitter;
      const receiver = other(hitter);
      if (event.type === "net") {
        this.endRally(receiver, "net");
      } else if (++s.bounces === 1) {
        const good =
          s.shots === 1 && this.opts.mode === "match"
            ? inServiceCourt(receiver, -this.serveX(hitter), event.p)
            : inCourt(receiver, event.p);
        if (!good) this.endRally(receiver, "out");
      } else {
        this.endRally(hitter, "double-bounce");
      }
    }
    if (s.phase === "point-over" && s.phaseTime >= POINT_PAUSE) {
      if (s.score.winner !== null) {
        s.phase = "match-over";
        s.phaseTime = 0;
        this.events.push({ type: "match-over", winner: s.score.winner });
      } else {
        this.startServe();
      }
    }
  }

  /** x of the spot `side` serves from at the current score. */
  private serveX(side: Side) {
    const right = this.opts.mode === "practice" || servesFromRight(this.state.score);
    // Looking at the net, side 0's right is +x and side 1's is -x.
    return 1.5 * zSign(side) * (right ? 1 : -1);
  }

  /** Where each player stands for the next serve. */
  private servePositions(): [Vec3, Vec3] {
    const { server } = this.state.score;
    const x = this.serveX(server);
    const spots: [Vec3, Vec3] = [[0, 0, 0], [0, 0, 0]];
    spots[server] = [x, 0, zSign(server) * (COURT.halfLength + 0.3)];
    spots[other(server)] = [-x, 0, zSign(other(server)) * 6];
    return spots;
  }

  private startServe() {
    const s = this.state;
    s.phase = "serve";
    s.phaseTime = 0;
    s.lastHitter = null;
    s.bounces = 0;
    s.shots = 0;
    if (this.opts.mode === "match") {
      this.servePositions().forEach((spot, side) => {
        s.players[side].x = spot[0];
        s.players[side].z = spot[2];
      });
    }
    this.holdBall();
    this.events.push({ type: "serve-ready", server: s.score.server });
  }

  /** Before the serve the ball sits in the server's hand (or with the feeder). */
  private holdBall() {
    const s = this.state;
    if (this.opts.mode === "practice") {
      s.ball = { p: [0, 1, -COURT.halfLength], v: [0, 0, 0] };
      return;
    }
    const side = s.score.server;
    const me = s.players[side];
    s.ball = { p: [me.x + 0.35 * zSign(side), 0.9, me.z - 0.3 * zSign(side)], v: [0, 0, 0] };
  }

  private serve(side: Side, swing: Swing) {
    const s = this.state;
    const me = s.players[side];
    me.swingAge = 0;
    me.kind = "forehand";
    const power = clamp(swing.power, 0, 1);
    const depth = 3.4 + 2.8 * power + Math.max(0, power - 0.92) * 10;
    const v = launchTo(s.ball.p, -this.serveX(side), -zSign(side) * depth, lerp(1.5, 1.05, power));
    s.phase = "rally";
    s.phaseTime = 0;
    this.launch(side, { power, kind: "forehand" }, v);
  }

  /** Practice: the machine sends a ball over from the far baseline. */
  private feed() {
    const s = this.state;
    const { rng } = this.opts;
    s.ball.p = [(rng() - 0.5) * 2, 1, -COURT.halfLength];
    const v = launchTo(s.ball.p, (rng() - 0.5) * 3.5, 4 + rng() * 1.5, 1.5);
    s.phase = "rally";
    s.phaseTime = 0;
    s.shots = 9; // a fed ball is never a serve
    this.launch(1, { power: 0.5, kind: "forehand" }, v);
  }

  private launch(side: Side, swing: Swing, v: Vec3) {
    const s = this.state;
    s.ball.v = v;
    s.lastHitter = side;
    s.bounces = 0;
    s.shots++;
    this.events.push({
      type: "hit",
      side,
      kind: swing.kind,
      power: swing.power,
      ball: { p: [...s.ball.p], v: [...v] },
      shot: s.shots,
    });
  }

  private endRally(winner: Side, reason: Reason) {
    // Online, only the player the ball is travelling to rules on the rally,
    // so a late swing can never disagree with a point already awarded.
    const receiver = other(this.state.lastHitter ?? winner);
    if (!this.opts.owns(receiver)) return;
    const score =
      this.opts.mode === "match"
        ? rallyWon(this.state.score, winner, this.opts.pointsToWin)
        : this.state.score;
    this.finishRally(winner, reason, score);
  }

  private finishRally(winner: Side, reason: Reason, score: Score) {
    const s = this.state;
    s.score = score;
    s.phase = "point-over";
    s.phaseTime = this.opts.mode === "practice" ? POINT_PAUSE - 1.2 : 0;
    s.rallies++;
    this.events.push({
      type: "rally-over",
      winner,
      reason,
      score: [...score.points],
      server: score.server,
    });
  }

  /** Moves a player towards where they should be. */
  private run(side: Side) {
    const s = this.state;
    const me = s.players[side];
    const sign = zSign(side);
    let x = 0;
    let z = sign * HOME_DEPTH;

    if (s.phase === "serve" || s.phase === "point-over") {
      if (this.opts.mode === "match" && s.score.winner === null) {
        const spot = this.servePositions()[side];
        x = spot[0];
        z = spot[2];
      }
    } else if (s.phase === "rally" && s.lastHitter !== side) {
      const { ball } = s;
      if (s.bounces === 0) {
        const landing = predictLanding(ball).p;
        if (depthOn(side, landing) > 0) {
          const speed = Math.hypot(ball.v[0], ball.v[2]) || 1;
          x = landing[0] + (ball.v[0] / speed) * STAND_BEHIND;
          // Stay out of the kitchen until the ball has bounced.
          const depth = depthOn(side, landing) + STAND_BEHIND;
          z = sign * clamp(depth, COURT.kitchen + 0.25, COURT.halfLength + 2);
        }
      } else {
        x = ball.p[0] + ball.v[0] * 0.15;
        z = sign * clamp(depthOn(side, ball.p) + ball.v[2] * sign * 0.15, 0.5, COURT.halfLength + 2.5);
      }
      x = clamp(x, -COURT.halfWidth - 1.5, COURT.halfWidth + 1.5);
    }

    const dx = x - me.x;
    const dz = z - me.z;
    const dist = Math.hypot(dx, dz);
    const stride = this.opts.speeds[side] * STEP;
    if (dist <= stride) {
      me.x = x;
      me.z = z;
    } else {
      me.x += (dx / dist) * stride;
      me.z += (dz / dist) * stride;
    }
  }
}
