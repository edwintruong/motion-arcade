import { expect, test } from "vitest";
import { AiPlayer } from "./ai";
import type { Side } from "./court";
import { Match, type MatchEvent } from "./match";
import { applyWire, toWire } from "./netplay";

const DT = 1 / 120;

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Two computers, each running its own copy of the match and playing one
 * side, joined by a network that delivers every message `delay` seconds late.
 * A scripted player stands in for each human.
 */
function onlineGame(delay: number, seed: number, pointsToWin = 4) {
  const computers = ([0, 1] as Side[]).map((side) => ({
    side,
    match: new Match({ mode: "match", pointsToWin, owns: (s) => s === side }),
    player: new AiPlayer(side, "normal", seeded(seed + side)),
    inbox: [] as { at: number; data: unknown }[],
    events: [] as MatchEvent[],
  }));
  let now = 0;
  const step = () => {
    now += DT;
    for (const c of computers) {
      const due = c.inbox.filter((m) => m.at <= now);
      c.inbox = c.inbox.filter((m) => m.at > now);
      // Sent as JSON, exactly like the real thing.
      for (const m of due) applyWire(c.match, JSON.parse(JSON.stringify(m.data)));
      c.player.update(c.match, DT);
      for (const event of c.match.step(DT)) {
        c.events.push(event);
        const wire = toWire(event);
        if (wire) computers[1 - c.side].inbox.push({ at: now + delay, data: wire });
      }
    }
  };
  return { computers, step, time: () => now };
}

function playToEnd(game: ReturnType<typeof onlineGame>, maxSeconds = 900) {
  const [a, b] = game.computers;
  while (game.time() < maxSeconds) {
    game.step();
    if (a.match.state.phase === "match-over" && b.match.state.phase === "match-over") return;
  }
  throw new Error(`match did not finish: ${a.match.state.score.points} vs ${b.match.state.score.points}`);
}

const overs = (events: MatchEvent[]) =>
  events.filter((e) => e.type === "rally-over").map((e) => (e.type === "rally-over" ? [e.winner, e.reason, ...e.score, e.server] : []));

test.each([0, 0.05, 0.15, 0.3])(
  "with %ss of network delay both computers agree on every rally and on the winner",
  (delay) => {
    for (const seed of [1, 2, 3]) {
      const game = onlineGame(delay, seed);
      playToEnd(game);
      const [a, b] = game.computers;
      expect(overs(a.events)).toEqual(overs(b.events));
      expect(a.match.state.score).toEqual(b.match.state.score);
      expect(a.match.state.score.winner).not.toBeNull();
    }
  },
);

test("real rallies happen online: both players get to hit the ball", () => {
  const game = onlineGame(0.08, 5);
  playToEnd(game);
  const hits = game.computers[0].events.filter((e) => e.type === "hit" && e.shot > 1);
  expect(hits.some((e) => e.type === "hit" && e.side === 0)).toBe(true);
  expect(hits.some((e) => e.type === "hit" && e.side === 1)).toBe(true);
});

test("a computer only reports its own player's hits and its own rulings", () => {
  const game = onlineGame(0.05, 1);
  playToEnd(game);
  for (const c of game.computers) {
    const sent = c.events.map(toWire).filter((w) => w !== null);
    expect(sent.filter((w) => w.k === "hit").every((w) => w.side === c.side)).toBe(true);
    expect(sent.length).toBeLessThan(c.events.length);
  }
});

test("the ball's position is only corrected when the opponent hits, not continuously", () => {
  const game = onlineGame(0.1, 2);
  const [a] = game.computers;
  let jumps = 0;
  let previous = [...a.match.state.ball.p];
  while (a.match.state.phase !== "match-over" && game.time() < 900) {
    game.step();
    const p = a.match.state.ball.p;
    const moved = Math.hypot(p[0] - previous[0], p[1] - previous[1], p[2] - previous[2]);
    const remoteHit = a.events.at(-1)?.type === "hit";
    if (moved > 0.5 && a.match.state.phase === "rally" && !remoteHit) jumps++;
    previous = [...p];
  }
  expect(jumps).toBe(0);
});

test("after the match either player can start a rematch for both", () => {
  const game = onlineGame(0.05, 1);
  playToEnd(game);
  const [a, b] = game.computers;
  a.match.restart();
  applyWire(b.match, { k: "rematch" });
  expect(b.match.state.phase).toBe("serve");
  expect(b.match.state.score.points).toEqual([0, 0]);
});

test("garbage from the network is ignored", () => {
  const m = new Match({ mode: "match", owns: (s) => s === 0 });
  const before = JSON.stringify(m.state);
  for (const junk of [null, 1, "x", {}, { k: "hit" }, { k: "hit", side: 1, kind: "forehand", power: 1, p: [0, "a", 0], v: [0, 0, 0], shot: 1 }, { k: "over", winner: 5 }])
    expect(applyWire(m, junk)).toBe(false);
  expect(JSON.stringify(m.state)).toBe(before);
});

test("a computer cannot be told that its own player hit the ball", () => {
  const m = new Match({ mode: "match", owns: (s) => s === 0 });
  const forged = { k: "hit", side: 0, kind: "forehand", power: 1, p: [0, 1, 0], v: [0, 0, 1], shot: 1 };
  expect(applyWire(m, forged)).toBe(false);
});
