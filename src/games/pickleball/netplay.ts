import type { SwingKind } from "../../shared/gestures/swing";
import type { Vec3 } from "../../shared/quat";
import type { Side } from "./court";
import type { Match, MatchEvent, Reason } from "./match";

/**
 * What two computers playing each other online tell one another.
 * Between hits the ball's flight is fully determined, so only hits and
 * rally results need to cross the network.
 */
export type Wire =
  | { k: "hit"; side: Side; kind: SwingKind; power: number; p: Vec3; v: Vec3; shot: number }
  | { k: "over"; winner: Side; reason: Reason; points: [number, number]; server: Side; champion: Side | null }
  | { k: "rematch" };

/** The message to send for something that happened on this computer, if any. */
export function toWire(event: MatchEvent): Wire | null {
  if (event.type === "hit" && !event.remote)
    return { k: "hit", side: event.side, kind: event.kind, power: event.power, p: event.ball.p, v: event.ball.v, shot: event.shot };
  if (event.type === "rally-over" && !event.remote)
    return { k: "over", winner: event.winner, reason: event.reason, points: event.score, server: event.server, champion: event.champion };
  return null;
}

const KINDS: readonly unknown[] = ["forehand", "backhand", "lob", "smash"];
const REASONS: readonly unknown[] = ["out", "net", "double-bounce", "two-bounce-rule", "kitchen"];
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const side = (v: unknown): v is Side => v === 0 || v === 1;
const vec = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(num);

/** Applies a message from the other computer. Returns false if it was not usable. */
export function applyWire(match: Match, data: unknown): boolean {
  const m = data as Record<string, unknown> | null;
  if (typeof m !== "object" || m === null) return false;
  if (m.k === "hit") {
    const ok = side(m.side) && KINDS.includes(m.kind) && num(m.power) && vec(m.p) && vec(m.v) && Number.isInteger(m.shot);
    if (!ok || match.owns(m.side as Side)) return false;
    match.applyRemoteHit({
      side: m.side as Side,
      kind: m.kind as SwingKind,
      power: Math.min(1, Math.max(0, m.power as number)),
      ball: { p: m.p as Vec3, v: m.v as Vec3 },
      shot: m.shot as number,
    });
    return true;
  }
  if (m.k === "over") {
    const points = m.points;
    const ok =
      side(m.winner) && REASONS.includes(m.reason) && side(m.server) &&
      Array.isArray(points) && points.length === 2 && points.every(num) &&
      (m.champion === null || side(m.champion));
    if (!ok) return false;
    match.applyRemoteRallyOver(m.winner as Side, m.reason as Reason, {
      points: points as [number, number],
      server: m.server as Side,
      winner: m.champion as Side | null,
    });
    return true;
  }
  if (m.k === "rematch") {
    if (match.state.phase === "match-over") match.restart();
    return true;
  }
  return false;
}
