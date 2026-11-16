import { axisAngle, mul, rotate, type Quat } from "../quat";

const RAD = Math.PI / 180;

/**
 * Turns the browser's device-orientation angles (degrees) into the
 * rotation from the phone's own axes (x right edge, y top edge, z out of
 * the screen) to the world (x east, y north, z up).
 */
export function deviceOrientationToQuat(
  alpha: number,
  beta: number,
  gamma: number,
): Quat {
  const z = axisAngle([0, 0, 1], alpha * RAD);
  const x = axisAngle([1, 0, 0], beta * RAD);
  const y = axisAngle([0, 1, 0], gamma * RAD);
  return mul(mul(z, x), y);
}

/**
 * The turn about the vertical that makes wherever the phone's top is
 * pointing right now count as "forward" (north). Apply it in front of
 * every later orientation: `mul(calibration, orientation)`.
 * Returns null when the phone points straight up or down, where heading
 * is meaningless.
 */
export function yawCalibration(orientation: Quat): Quat | null {
  const top = rotate(orientation, [0, 1, 0]);
  if (Math.hypot(top[0], top[1]) < 0.2) return null;
  return axisAngle([0, 0, 1], Math.atan2(top[0], top[1]));
}
