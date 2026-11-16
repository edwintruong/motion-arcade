import { expect, test } from "vitest";
import { rotate, mul, type Vec3 } from "../quat";
import { deviceOrientationToQuat, yawCalibration } from "./orientation";

const TOP: Vec3 = [0, 1, 0]; // out of the top edge of the phone
const RIGHT: Vec3 = [1, 0, 0]; // out of the right edge of the phone

function expectVec(actual: Vec3, expected: Vec3) {
  actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 5));
}

// World frame: x east, y north, z up (the W3C device-orientation frame).

test("a phone flat on a table pointing north is the reference pose", () => {
  const q = deviceOrientationToQuat(0, 0, 0);
  expectVec(rotate(q, TOP), [0, 1, 0]);
  expectVec(rotate(q, RIGHT), [1, 0, 0]);
});

test("turning the phone a quarter turn counter-clockwise points its top west", () => {
  expectVec(rotate(deviceOrientationToQuat(90, 0, 0), TOP), [-1, 0, 0]);
});

test("standing the phone upright points its top at the sky", () => {
  expectVec(rotate(deviceOrientationToQuat(0, 90, 0), TOP), [0, 0, 1]);
});

test("rolling the phone onto its right edge points that edge at the floor", () => {
  expectVec(rotate(deviceOrientationToQuat(0, 0, 90), RIGHT), [0, 0, -1]);
});

test("calibrating while pointing at the screen makes that direction 'forward' (north)", () => {
  const pointingWestTiltedUp = deviceOrientationToQuat(90, 30, 0);
  const cal = yawCalibration(pointingWestTiltedUp);
  const top = rotate(mul(cal!, pointingWestTiltedUp), TOP);
  expectVec(top, [0, Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)]);
});
