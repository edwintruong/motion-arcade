import type { Vec3 } from "../../shared/quat";
import { COURT } from "./court";

export interface Ball {
  p: Vec3;
  v: Vec3;
}

export const GRAVITY = 9.8;
export const BALL_RADIUS = 0.037;
const RESTITUTION = 0.68;
/** Share of horizontal speed kept through a bounce. */
const GRIP = 0.8;
const NET_OVERHANG = 0.3;

export type BallEvent = { type: "bounce"; p: Vec3 } | { type: "net" };

/** Advances the ball by `dt` seconds; reports a bounce or a net strike. */
export function stepBall(ball: Ball, dt: number): BallEvent | null {
  const { p, v } = ball;
  const z0 = p[2];
  v[1] -= GRAVITY * dt;
  p[0] += v[0] * dt;
  p[1] += v[1] * dt;
  p[2] += v[2] * dt;

  const crossedNet = z0 !== 0 && Math.sign(z0) !== Math.sign(p[2]);
  if (crossedNet && p[1] < COURT.netHeight && Math.abs(p[0]) < COURT.halfWidth + NET_OVERHANG) {
    // Dies against the net and drops on the side it came from.
    p[2] = Math.sign(z0) * 0.05;
    v[0] *= 0.3;
    v[1] *= 0.3;
    v[2] *= -0.12;
    return { type: "net" };
  }

  if (p[1] <= BALL_RADIUS && v[1] < 0) {
    p[1] = BALL_RADIUS;
    if (v[1] > -0.8) {
      // Too slow to bounce again: it rolls.
      v[1] = 0;
      v[0] *= 0.98;
      v[2] *= 0.98;
      return null;
    }
    v[1] *= -RESTITUTION;
    v[0] *= GRIP;
    v[2] *= GRIP;
    return { type: "bounce", p: [p[0], p[1], p[2]] };
  }
  return null;
}

/** Where and when a ball in flight will next touch the ground (ignoring the net). */
export function predictLanding(ball: Ball): { p: Vec3; t: number } {
  const [, y] = ball.p;
  const vy = ball.v[1];
  const t = (vy + Math.sqrt(vy * vy + 2 * GRAVITY * Math.max(0, y - BALL_RADIUS))) / GRAVITY;
  return { p: [ball.p[0] + ball.v[0] * t, BALL_RADIUS, ball.p[2] + ball.v[2] * t], t };
}

/** The launch velocity that lands a ball from `from` on (x, z) after `airtime` seconds. */
export function launchTo(from: Vec3, x: number, z: number, airtime: number): Vec3 {
  return [
    (x - from[0]) / airtime,
    (BALL_RADIUS - from[1] + 0.5 * GRAVITY * airtime * airtime) / airtime,
    (z - from[2]) / airtime,
  ];
}
