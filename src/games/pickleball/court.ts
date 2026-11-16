import type { Vec3 } from "../../shared/quat";

/**
 * Court geometry in metres. x runs across the court, y is up, z runs
 * along it with the net at z = 0. Side 0 plays on z > 0, side 1 on z < 0.
 */
export const COURT = {
  halfWidth: 3.05,
  halfLength: 6.705,
  /** The non-volley zone reaches this far from the net. */
  kitchen: 2.13,
  netHeight: 0.88,
} as const;

export type Side = 0 | 1;
export const other = (side: Side): Side => (side === 0 ? 1 : 0);
/** +1 for the side on z > 0, -1 for the side on z < 0. */
export const zSign = (side: Side) => (side === 0 ? 1 : -1);

/** How far into `side`'s half a point is: 0 at the net, negative if on the other half. */
export const depthOn = (side: Side, p: Vec3) => p[2] * zSign(side);

export function inCourt(side: Side, p: Vec3): boolean {
  const depth = depthOn(side, p);
  return Math.abs(p[0]) <= COURT.halfWidth && depth > 0 && depth <= COURT.halfLength;
}

/** A serve must land past the kitchen, in the half of the court at `xSign`. */
export function inServiceCourt(side: Side, xSign: number, p: Vec3): boolean {
  return inCourt(side, p) && depthOn(side, p) > COURT.kitchen && p[0] * xSign >= 0;
}
