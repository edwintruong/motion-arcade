import { expect, test } from "vitest";
import type { Quat, Vec3 } from "../quat";
import { deviceOrientationToQuat } from "./orientation";
import { SwingDetector, type DetectedSwing } from "./swing";

/**
 * Synthetic gyroscope traces shaped like real swings: a bell curve of
 * angular speed around one world axis, sampled at 60 Hz. The phone is
 * held flat pointing forward (north), like a racket held out in front.
 */
const FORWARD: Quat = deviceOrientationToQuat(0, 0, 0);
const UP: Vec3 = [0, 0, 1];
const DOWN: Vec3 = [0, 0, -1];
const EAST: Vec3 = [1, 0, 0];
const WEST: Vec3 = [-1, 0, 0];

function bell(peakDegPerSec: number, axis: Vec3, startMs = 0, widthMs = 300) {
  const samples = [];
  for (let t = 0; t <= widthMs; t += 1000 / 60) {
    const x = (t - widthMs / 2) / (widthMs / 6);
    const speed = peakDegPerSec * Math.exp(-0.5 * x * x);
    samples.push({
      t: startMs + t,
      rate: axis.map((a) => a * speed) as Vec3,
      q: FORWARD,
    });
  }
  return samples;
}

function run(detector: SwingDetector, samples: ReturnType<typeof bell>) {
  const swings: DetectedSwing[] = [];
  for (const s of samples) {
    const swing = detector.push(s);
    if (swing) swings.push(swing);
  }
  return swings;
}

test("one swing of the phone is detected as exactly one swing", () => {
  expect(run(new SwingDetector(), bell(900, UP))).toHaveLength(1);
});

test("a hard swing has more power than a gentle one", () => {
  const [hard] = run(new SwingDetector(), bell(1200, UP));
  const [gentle] = run(new SwingDetector(), bell(500, UP));
  expect(hard.power).toBeGreaterThan(gentle.power + 0.3);
  expect(gentle.power).toBeGreaterThanOrEqual(0);
  expect(hard.power).toBeLessThanOrEqual(1);
});

test("carrying the phone or turning it slowly is not a swing", () => {
  expect(run(new SwingDetector(), bell(150, UP, 0, 1200))).toHaveLength(0);
  expect(run(new SwingDetector(), bell(250, EAST, 0, 800))).toHaveLength(0);
});

test("two swings in a row are two swings", () => {
  const d = new SwingDetector();
  const swings = [...run(d, bell(900, UP)), ...run(d, bell(900, UP, 700))];
  expect(swings).toHaveLength(2);
});

test("the swing is reported around its fastest moment, not after it has finished", () => {
  const d = new SwingDetector();
  const samples = bell(900, UP);
  const firedAt = samples.find((s) => d.push(s))!.t;
  expect(firedAt).toBeLessThan(220); // peak is at 150 ms, trace ends at 300 ms
});

// Spinning counter-clockwise seen from above moves the tip from right to left.
test("swinging right-to-left is a forehand for a right-hander", () => {
  expect(run(new SwingDetector(), bell(900, UP))[0].kind).toBe("forehand");
});

test("swinging left-to-right is a backhand for a right-hander", () => {
  expect(run(new SwingDetector(), bell(900, DOWN))[0].kind).toBe("backhand");
});

test("for a left-hander the same motions are the opposite strokes", () => {
  const lefty = () => new SwingDetector({ leftHanded: true });
  expect(run(lefty(), bell(900, UP))[0].kind).toBe("backhand");
  expect(run(lefty(), bell(900, DOWN))[0].kind).toBe("forehand");
});

test("flicking the tip upward is a lob", () => {
  expect(run(new SwingDetector(), bell(900, EAST))[0].kind).toBe("lob");
});

test("chopping the tip downward is a smash", () => {
  expect(run(new SwingDetector(), bell(900, WEST))[0].kind).toBe("smash");
});
