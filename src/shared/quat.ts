/** Minimal vector and quaternion maths shared by phone, computer and tests. */

export type Vec3 = [number, number, number];
/** [x, y, z, w] */
export type Quat = [number, number, number, number];

export const IDENTITY: Quat = [0, 0, 0, 1];

export function axisAngle(axis: Vec3, radians: number): Quat {
  const s = Math.sin(radians / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(radians / 2)];
}

/** The rotation "b, then a". */
export function mul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function length(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

export function rotate(q: Quat, v: Vec3): Vec3 {
  const u: Vec3 = [q[0], q[1], q[2]];
  const t = cross(u, v).map((c) => 2 * c) as Vec3;
  const c = cross(u, t);
  return [
    v[0] + q[3] * t[0] + c[0],
    v[1] + q[3] * t[1] + c[1],
    v[2] + q[3] * t[2] + c[2],
  ];
}
