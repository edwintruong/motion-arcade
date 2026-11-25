import { mul, rotate, type Quat, type Vec3 } from "../quat";

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
  private speed = 0;
  private slide = 0;
  private slideUntil = 0;
  private candidate = 0;
  private candidateSince = 0;
  private armed = true;
  private quietSince: number | null = null;

  calibrate(q: Quat) {
    this.neutral = [...q];
    this.locked = false;
    this.blockedUntil = 0;
    this.heldSince = null;
    this.x = this.y = 0;
    this.slide = 0;
    this.slideUntil = 0;
    this.candidate = 0;
    this.armed = true;
    this.quietSince = null;
  }

  motion(speed: number, now: number) {
    this.lastMotion = now;
    this.speed = speed;
    if (speed >= 180) {
      this.locked = true;
      this.blockedUntil = now + 400;
      this.x = this.y = 0;
      this.slide = 0;
      this.candidate = 0;
    }
  }

  /** A short lateral acceleration is an intent to sidestep, never a position estimate. */
  acceleration(q: Quat, acceleration: Vec3, now: number) {
    if (!this.neutral || acceleration.some(v => !Number.isFinite(v))) return;
    const [x, y, z] = rotate(q, acceleration);
    if (now < this.blockedUntil || this.speed > 120 || now - this.lastMotion > 250) {
      this.candidate = 0;
      return;
    }
    if (Math.abs(x) < .35) {
      this.candidate = 0;
      this.quietSince ??= now;
      if (now > this.slideUntil + 250 && now - this.quietSince > 200) this.armed = true;
      return;
    }
    this.quietSince = null;
    if (!this.armed || Math.abs(x) < .85 || Math.abs(x) > 10 || Math.abs(x) < Math.hypot(y, z) * 1.3) {
      this.candidate = 0;
      return;
    }
    const direction = Math.sign(x);
    if (direction !== this.candidate) {
      this.candidate = direction;
      this.candidateSince = now;
    }
    if (now - this.candidateSince >= 70) {
      this.slide = direction * Math.min(1, .55 + Math.abs(x) / 8);
      this.slideUntil = now + 650;
      this.armed = false; // Ignore the opposite acceleration as the hand brakes.
      this.candidate = 0;
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
    if (now < this.blockedUntil || now - this.lastMotion > 250) {
      this.heldSince = null;
      this.x = this.y = 0;
      return { x: 0, y: 0 };
    }
    const slide = now < this.slideUntil ? this.slide * Math.min(1, (this.slideUntil - now) / 200) : 0;
    if (centered || this.locked) {
      this.heldSince = null;
      this.x = this.y = 0;
      return { x: slide, y: 0 };
    }
    this.heldSince ??= now;
    if (now - this.heldSince < 120) return { x: slide, y: 0 };
    const axis = (v: number) => Math.sign(v) * Math.min(1, Math.max(0, Math.abs(v) - deadzone) / (20 * Math.PI / 180));
    const blend = 1 - Math.exp(-dt * 12);
    this.x += (axis(horizontal) - this.x) * blend;
    this.y += (axis(vertical) - this.y) * blend;
    const x = Math.max(-1, Math.min(1, this.x + slide));
    const length = Math.max(1, Math.hypot(x, this.y));
    return { x: x / length, y: this.y / length };
  }
}
