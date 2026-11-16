import { deviceOrientationToQuat, yawCalibration } from "../../shared/gestures/orientation";
import { SwingDetector, type DetectedSwing } from "../../shared/gestures/swing";
import { IDENTITY, mul, type Quat } from "../../shared/quat";

export interface SensorHandlers {
  onOrientation(q: Quat): void;
  onSwing(swing: DetectedSwing): void;
}

export type SensorStart = "ok" | "denied" | "unavailable";

type Permissioned = { requestPermission?: () => Promise<string> };

/** The phone's motion sensors, turned into calibrated orientation and swings. */
export class Sensors {
  private raw: Quat = IDENTITY;
  private calibration: Quat | null = null;
  private detector = new SwingDetector();
  private lastSent = 0;

  constructor(private handlers: SensorHandlers) {}

  setLeftHanded(leftHanded: boolean) {
    this.detector.setLeftHanded(leftHanded);
  }

  /** Whatever the phone points at now becomes "straight at the screen". */
  calibrate() {
    this.calibration = yawCalibration(this.raw) ?? this.calibration;
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
    });
    window.addEventListener("devicemotion", (e) => {
      const r = e.rotationRate;
      if (!r || r.alpha === null || r.beta === null || r.gamma === null) return;
      const swing = this.detector.push({
        t: performance.now(),
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
