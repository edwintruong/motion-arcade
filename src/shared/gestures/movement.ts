import { mul, rotate, type Quat } from "../quat";

/** Slow steering is distinct from a fast stroke. A stroke locks steering until neutral. */
export class MovementDetector {
  private neutral: Quat | null = null;
  private locked = false;
  private blockedUntil = 0;
  private lastMotion = -Infinity;
  private previous = 0;
  private heldSince: number | null = null;
  private x = 0;
  private y = 0;

  calibrate(q: Quat) {
    this.neutral = [...q];
    this.locked = false;
    this.blockedUntil = 0;
    this.heldSince = null;
    this.x = this.y = 0;
  }

  motion(speed: number, now: number) {
    this.lastMotion = now;
    if (speed >= 180) {
      this.locked = true;
      this.blockedUntil = now + 400;
      this.x = this.y = 0;
    }
  }

  update(q: Quat, now: number): { x: number; y: number } {
    if (!this.neutral) this.calibrate(q);
    const n = this.neutral!;
    const relative = mul(q, [-n[0], -n[1], -n[2], n[3]]);
    const tip = rotate(relative, [0, 1, 0]);
    const horizontal = Math.atan2(tip[0], tip[1]);
    const vertical = Math.atan2(tip[2], Math.hypot(tip[0], tip[1]));
    const deadzone = 10 * Math.PI / 180;
    const centered = Math.abs(horizontal) < deadzone && Math.abs(vertical) < deadzone;
    const dt = Math.min(0.1, Math.max(0, (now - this.previous) / 1000));
    this.previous = now;
    if (centered && now >= this.blockedUntil) this.locked = false;
    if (centered || this.locked || now < this.blockedUntil || now - this.lastMotion > 250) {
      this.heldSince = null;
      this.x = this.y = 0;
      return { x: 0, y: 0 };
    }
    this.heldSince ??= now;
    if (now - this.heldSince < 120) return { x: 0, y: 0 };
    const axis = (v: number) => Math.sign(v) * Math.min(1, Math.max(0, Math.abs(v) - deadzone) / (20 * Math.PI / 180));
    const blend = 1 - Math.exp(-dt * 12);
    this.x += (axis(horizontal) - this.x) * blend;
    this.y += (axis(vertical) - this.y) * blend;
    const length = Math.max(1, Math.hypot(this.x, this.y));
    return { x: this.x / length, y: this.y / length };
  }
}
