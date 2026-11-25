import { expect, test } from "vitest";
import { parseControllerMsg } from "../../shared/messages";
import { COURT } from "./court";
import { Match } from "./match";
import { applyWire } from "./netplay";

function rally() {
  const match = new Match({ mode: "practice" });
  match.state.phase = "rally";
  match.state.lastHitter = 0;
  match.state.ball = { p: [0, 100, 0], v: [0, 0, 0] };
  return match;
}

test("screen-right movement is mirrored on the opposite court; stale input returns to assistance", () => {
  const m = rally();
  m.move(0, 1, 0); m.move(1, 1, 0); m.step(.2);
  expect(m.state.players[0].x).toBeCloseTo(1);
  expect(m.state.players[1].x).toBeCloseTo(-1);
  m.step(.4);
  expect(m.state.players[0].x).toBeCloseTo(0);
});

test("diagonal motion cannot boost running speed and players cannot cross the net", () => {
  const m = rally(); const p = m.state.players[0];
  const before = { x: p.x, z: p.z };
  m.move(0, 1, -1); m.step(.2);
  expect(Math.hypot(p.x - before.x, p.z - before.z)).toBeCloseTo(1);
  for (let i = 0; i < 40; i++) { m.move(0, 1, -1); m.step(.2); }
  expect(p.x).toBeLessThanOrEqual(COURT.halfWidth + 1.5);
  expect(p.z).toBeGreaterThanOrEqual(.5);
});

test("motion does not change serve positions; neutral explicitly restores assistance", () => {
  const m = new Match({ mode: "match" });
  const x = m.state.players[0].x;
  m.move(0, 1, 0); m.step(.2);
  expect(m.state.players[0].x).toBe(x);
  const practice = rally(); practice.move(0, 1, 0); practice.step(.2);
  practice.move(0, 0, 0); practice.step(.1);
  expect(practice.state.players[0].x).toBeLessThan(1);
});

test("network movement is validated and remote positions cannot move the local player", () => {
  expect(parseControllerMsg({k:'move',x:NaN,y:0})).toBeNull();
  expect(parseControllerMsg({k:'move',x:Infinity,y:0})).toBeNull();
  expect(parseControllerMsg({k:'move',x:3,y:4})).toEqual({k:'move',x:.6,y:.8});
  const m = new Match({mode:'match',owns: side => side === 0});
  expect(applyWire(m,{k:'player',side:0,x:100,z:0})).toBe(false);
  expect(applyWire(m,{k:'player',side:1,x:NaN,z:-3})).toBe(false);
  expect(applyWire(m,{k:'player',side:1,x:100,z:100})).toBe(true);
  m.step(1);
  expect(m.state.players[1].x).toBeCloseTo(COURT.halfWidth + 1.5);
  expect(m.state.players[1].z).toBeCloseTo(-.5);
});

test("hit cue respects the two-bounce and kitchen rules", () => {
  const m = new Match({mode:'match'});
  m.state.phase = 'rally'; m.state.lastHitter = 1;
  m.state.players[0].x = 0; m.state.players[0].z = 1;
  m.state.ball.p = [0,1,1]; m.state.shots = 3; m.state.bounces = 0;
  expect(m.canHit(0)).toBe(false);
  m.state.bounces = 1;
  expect(m.canHit(0)).toBe(true);
});
