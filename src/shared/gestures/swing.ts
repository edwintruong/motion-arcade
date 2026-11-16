import { cross, length, rotate, type Quat, type Vec3 } from "../quat";

export type SwingKind = "forehand" | "backhand" | "lob" | "smash";

export interface DetectedSwing {
  /** 0 (barely a swing) to 1 (as hard as it gets). */
  power: number;
  kind: SwingKind;
}

export interface MotionSample {
  /** Milliseconds, any epoch. */
  t: number;
  /** Angular velocity about the phone's own x, y, z axes, degrees/second. */
  rate: Vec3;
  /** Calibrated orientation of the phone at this moment (forward = north). */
  q: Quat;
}

/** Angular speeds in degrees/second. */
const START = 200; // below this the phone is just being held
const FIRE = 360; // a swing must get at least this fast
const FULL_POWER = 1300;
const REARM = 120; // must calm down to this before the next swing
const REARM_MS = 250;
/** How vertical the tip's motion must be to count as a lob or smash. */
const VERTICAL = 0.6;

/**
 * Finds swings in a stream of gyroscope samples and reports each one
 * once, just after its fastest moment, so the game can react while the
 * arm is still moving.
 */
export class SwingDetector {
  private state: "idle" | "swinging" | "cooldown" = "idle";
  private peak = 0;
  private peakSample!: MotionSample;
  private firedAt = 0;
  private leftHanded: boolean;

  constructor(options: { leftHanded?: boolean } = {}) {
    this.leftHanded = options.leftHanded ?? false;
  }

  setLeftHanded(leftHanded: boolean) {
    this.leftHanded = leftHanded;
  }

  push(sample: MotionSample): DetectedSwing | null {
    const speed = length(sample.rate);
    switch (this.state) {
      case "idle":
        if (speed >= START) {
          this.state = "swinging";
          this.peak = speed;
          this.peakSample = sample;
        }
        return null;
      case "swinging":
        if (speed > this.peak) {
          this.peak = speed;
          this.peakSample = sample;
        } else if (this.peak >= FIRE && speed < this.peak * 0.85) {
          this.state = "cooldown";
          this.firedAt = sample.t;
          return this.describe();
        } else if (speed < START) {
          this.state = "idle";
        }
        return null;
      case "cooldown":
        if (speed < REARM && sample.t - this.firedAt >= REARM_MS)
          this.state = "idle";
        return null;
    }
  }

  private describe(): DetectedSwing {
    const power = Math.min(1, (this.peak - FIRE) / (FULL_POWER - FIRE));
    // Which way the tip of the phone was travelling at the fastest moment.
    const { q, rate } = this.peakSample;
    const spin = rotate(q, rate);
    const tip = cross(spin, rotate(q, [0, 1, 0]));
    const travel = length(tip) || 1;
    const up = tip[2] / travel;
    let kind: SwingKind;
    if (up > VERTICAL) kind = "lob";
    else if (up < -VERTICAL) kind = "smash";
    else kind = tip[0] < 0 !== this.leftHanded ? "forehand" : "backhand";
    return { power, kind };
  }
}
