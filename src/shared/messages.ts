import type { Quat } from "./quat";
import type { SwingKind } from "./gestures/swing";

/** What a phone tells the computer, carried in the server's relay messages. */
export type ControllerMsg =
  /** Calibrated orientation, streamed while the sensors are on. */
  | { k: "o"; q: Quat }
  | { k: "swing"; power: number; kind: SwingKind }
  /** Screen-relative joystick: up is towards the net. */
  | { k: "move"; x: number; y: number }
  | { k: "pong"; t: number };

/** What the computer tells a phone. */
export type HostMsg =
  | { k: "ping"; t: number }
  /** Vibrate, where the phone can. */
  | { k: "buzz"; ms: number }
  /** A line of text for the phone's screen. */
  | { k: "say"; text: string };

const KINDS: readonly string[] = ["forehand", "backhand", "lob", "smash"];
const num = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** Relayed data comes from another device; never trust its shape. */
export function parseControllerMsg(data: unknown): ControllerMsg | null {
  const m = data as Record<string, unknown> | null;
  if (typeof m !== "object" || m === null) return null;
  if (m.k === "o" && Array.isArray(m.q) && m.q.length === 4 && m.q.every(num))
    return { k: "o", q: m.q as Quat };
  if (m.k === "swing" && num(m.power) && KINDS.includes(m.kind as string))
    return {
      k: "swing",
      power: Math.min(1, Math.max(0, m.power)),
      kind: m.kind as SwingKind,
    };
  if (m.k === "pong" && num(m.t)) return { k: "pong", t: m.t };
  if (m.k === "move" && num(m.x) && num(m.y)) {
    const length = Math.max(1, Math.hypot(m.x, m.y));
    return { k: "move", x: m.x / length, y: m.y / length };
  }
  return null;
}
