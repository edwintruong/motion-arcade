import { deviceOrientationToQuat, yawCalibration } from "../../shared/gestures/orientation";
import { SwingDetector, type DetectedSwing } from "../../shared/gestures/swing";
import { MovementDetector } from "../../shared/gestures/movement";
import { IDENTITY, mul, type Quat } from "../../shared/quat";

export interface SensorHandlers {
  onOrientation(q: Quat): void;
  onSwing(swing: DetectedSwing): void;
  onMove?(movement: { x: number; y: number }): void;
}

export type SensorStart = "ok" | "denied" | "unavailable";

type Permissioned = { requestPermission?: () => Promise<string> };

/** The phone's motion sensors, turned into calibrated orientation and swings. */
export class Sensors {
  private raw: Quat = IDENTITY;
  private calibration: Quat | null = null;
  private detector = new SwingDetector();
  private lastSent = 0;
  private movement = new MovementDetector();

  constructor(private handlers: SensorHandlers) {}

  setLeftHanded(leftHanded: boolean) {
    this.detector.setLeftHanded(leftHanded);
  }

  /** Whatever the phone points at now becomes "straight at the screen". */
  calibrate() {
    this.calibration = yawCalibration(this.raw) ?? this.calibration;
    this.movement.calibrate(this.current());
    this.handlers.onMove?.({ x: 0, y: 0 });
  }

  /** Must be called from a tap: iOS only asks for permission then. */
  async start(): Promise<SensorStart> {
    if (!("DeviceMotionEvent" in window) || !("DeviceOrientationEvent" in window))
      return "unavailable";
    try {
      for (const api of [DeviceMotionEvent, DeviceOrientationEvent] as Permissioned[])
        if (api.requestPermission && (await api.requestPermission()) !== "granted")
          return "denied";
    } catch {
      return "denied";
    }

    let seen = false;
    window.addEventListener("deviceorientation", (e) => {
      if (e.alpha === null || e.beta === null || e.gamma === null) return;
      seen = true;
      this.raw = deviceOrientationToQuat(e.alpha, e.beta, e.gamma);
      if (!this.calibration) this.calibrate();
      const now = performance.now();
      if (now - this.lastSent < 33) return; // ~30 Hz is plenty for drawing
      this.lastSent = now;
      this.handlers.onOrientation(this.current());
      if (document.visibilityState === "visible")
        this.handlers.onMove?.(this.movement.update(this.current(), now));
    });
    window.addEventListener("devicemotion", (e) => {
      const r = e.rotationRate;
      if (!r || r.alpha === null || r.beta === null || r.gamma === null) return;
      const now = performance.now();
      const speed = Math.hypot(r.beta, r.gamma, r.alpha);
      this.movement.motion(speed, now);
      if (speed >= 180) this.handlers.onMove?.({ x: 0, y: 0 });
      if (document.visibilityState !== "visible") return;
      const swing = this.detector.push({
        t: now,
        // The browser names rates by axis: beta = x, gamma = y, alpha = z.
        rate: [r.beta, r.gamma, r.alpha],
        q: this.current(),
      });
      if (swing) this.handlers.onSwing(swing);
    });

    // Desktop browsers have the APIs but never fire them.
    await new Promise((r) => setTimeout(r, 1200));
    return seen ? "ok" : "unavailable";
  }

  private current(): Quat {
    return this.calibration ? mul(this.calibration, this.raw) : this.raw;
  }
}
