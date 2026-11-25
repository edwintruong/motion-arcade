import { expect, test } from "vitest";
import { axisAngle, IDENTITY, mul, type Quat } from "../quat";
import { MovementDetector } from "./movement";

const yaw = (degrees: number) => axisAngle([0, 0, 1], degrees * Math.PI / 180);
function hold(d: MovementDetector, q: Quat, start = 0, speed = 20) {
  let result = { x: 0, y: 0 };
  for (let t = start; t < start + 600; t += 20) {
    d.motion(speed, t);
    result = d.update(q, t);
  }
  return result;
}

test("small hand tremors do not move; deliberate sustained steering does", () => {
  const d = new MovementDetector(); d.calibrate(IDENTITY);
  expect(hold(d, yaw(7))).toEqual({ x: 0, y: 0 });
  expect(hold(d, yaw(-30), 600).x).toBeGreaterThan(.9);
  expect(hold(d, IDENTITY, 1200)).toEqual({ x: 0, y: 0 });
  expect(hold(d, yaw(30), 1800).x).toBeLessThan(-.9);
});

test("calibration works with a phone held on its side and diagonal speed is capped", () => {
  const d = new MovementDetector();
  const grip = axisAngle([0, 1, 0], Math.PI / 2);
  d.calibrate(grip);
  expect(hold(d, grip)).toEqual({ x: 0, y: 0 });
  const pose = mul(yaw(-35), mul(axisAngle([1, 0, 0], -.6), grip));
  const result = hold(d, pose, 600);
  expect(result.x).toBeGreaterThan(.4);
  expect(result.y).toBeLessThan(-.4);
  expect(Math.hypot(result.x, result.y)).toBeLessThanOrEqual(1);
});

test("a swing and its follow-through never steer until the phone returns to neutral", () => {
  const d = new MovementDetector(); d.calibrate(IDENTITY);
  expect(hold(d, yaw(-30)).x).toBeGreaterThan(.9);
  d.motion(800, 600);
  expect(d.update(yaw(40), 610)).toEqual({ x: 0, y: 0 });
  expect(hold(d, yaw(30), 1100)).toEqual({ x: 0, y: 0 });
  hold(d, IDENTITY, 1700);
  expect(hold(d, yaw(-30), 2300).x).toBeGreaterThan(.9);
});

test("stale motion samples stop steering; recalibration centers the new grip", () => {
  const d = new MovementDetector(); d.calibrate(IDENTITY);
  hold(d, yaw(-30));
  expect(d.update(yaw(-30), 1200)).toEqual({ x: 0, y: 0 });
  d.calibrate(yaw(-30));
  expect(hold(d, yaw(-30), 1400)).toEqual({ x: 0, y: 0 });
});

test.each([-1, 1])("a sideways hand translation %s steers without changing orientation", direction => {
  const d = new MovementDetector(); d.calibrate(IDENTITY);
  for (let t = 0; t <= 100; t += 20) {
    d.motion(0,t);
    d.acceleration(IDENTITY,[direction * 2,0,0],t);
  }
  expect(d.update(IDENTITY,100).x * direction).toBeGreaterThan(.5);
  // Braking is opposite acceleration, not a request to reverse direction.
  for (let t = 120; t <= 240; t += 20) {
    d.motion(0,t);
    d.acceleration(IDENTITY,[-direction * 2,0,0],t);
  }
  expect(d.update(IDENTITY,240).x * direction).toBeGreaterThan(.5);
  expect(hold(d,IDENTITY,1000)).toEqual({x:0,y:0});
});

test("a swing cancels lateral steering and vertical shake is not a sidestep", () => {
  const d = new MovementDetector(); d.calibrate(IDENTITY);
  for (let t = 0; t <= 100; t += 20) {
    d.motion(0,t); d.acceleration(IDENTITY,[0,0,4],t);
  }
  expect(d.update(IDENTITY,100)).toEqual({x:0,y:0});
  for (let t = 120; t <= 220; t += 20) {
    d.motion(0,t); d.acceleration(IDENTITY,[2,0,0],t);
  }
  expect(d.update(IDENTITY,220).x).toBeGreaterThan(.5);
  d.motion(800,240);
  expect(d.update(IDENTITY,240)).toEqual({x:0,y:0});
});

test("after the stroke settles, a deliberate sidestep works even before returning to neutral", () => {
  const d = new MovementDetector(); d.calibrate(IDENTITY);
  const followThrough = axisAngle([1,0,0], .5);
  d.motion(800,100);
  expect(hold(d,followThrough,120,0)).toEqual({x:0,y:0});
  for (let t = 800; t <= 900; t += 20) {
    d.motion(0,t); d.acceleration(followThrough,[2,0,0],t);
  }
  expect(d.update(followThrough,900).x).toBeGreaterThan(.5);
  expect(d.update(followThrough,900).y).toBe(0);
});
