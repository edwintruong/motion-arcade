import { expect, test } from "vitest";
import { AiPlayer, AI_LEVELS, type AiLevel } from "./ai";
import { Match, type MatchEvent, type Swing } from "./match";

const DT = 1 / 120;

/** Small seeded generator so every run plays out the same. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A human stand-in on side 0 who serves and returns every ball on time. */
function steadyHuman(m: Match, swing: Swing) {
  if (m.state.phase === "serve") m.swing(0, { power: 0.5, kind: "forehand" });
  const aim = m.aim(0);
  if (m.state.bounces >= 1 && aim.inReach && aim.timing <= 0) m.swing(0, swing);
}

function play(level: AiLevel, rallies: number, humanPower = 0.5, seed = 7) {
  const m = new Match({ mode: "match", pointsToWin: 999, speeds: [5, AI_LEVELS[level].speed] });
  const ai = new AiPlayer(1, level, seeded(seed));
  const events: MatchEvent[] = [];
  for (let t = 0; t < rallies * 60 && m.state.rallies < rallies; t += DT) {
    steadyHuman(m, { power: humanPower, kind: "forehand" });
    ai.update(m, DT);
    events.push(...m.step(DT));
  }
  const over = events.filter((e) => e.type === "rally-over");
  return {
    events,
    over,
    aiHits: events.filter((e) => e.type === "hit" && e.side === 1 && e.shot > 1).length,
    aiWins: over.filter((e) => e.winner === 1).length,
  };
}

test("the computer opponent serves by itself when it is its turn", () => {
  const m = new Match({ mode: "match" });
  const ai = new AiPlayer(1, "normal", seeded(1));
  const hits: MatchEvent[] = [];
  // The human serves and then stands still, so the serve passes to the opponent.
  for (let t = 0; t < 30; t += DT) {
    if (m.state.phase === "serve" && m.state.score.server === 0) m.swing(0, { power: 1, kind: "forehand" });
    ai.update(m, DT);
    hits.push(...m.step(DT).filter((e) => e.type === "hit"));
  }
  expect(hits.some((e) => e.type === "hit" && e.side === 1 && e.shot === 1)).toBe(true);
});

test("the opponent runs to the ball and returns it, making real rallies", () => {
  const { aiHits, over } = play("hard", 20);
  expect(over).toHaveLength(20);
  expect(aiHits).toBeGreaterThan(40); // more than two returns per rally on average
});

test("the opponent sometimes fails, and an easier opponent fails sooner", () => {
  const returnsPerRally = (level: AiLevel) => {
    const r = play(level, 60);
    return r.aiHits / r.over.length;
  };
  const easy = returnsPerRally("easy");
  const normal = returnsPerRally("normal");
  const hard = returnsPerRally("hard");
  expect(easy).toBeGreaterThan(0.5);
  expect(normal).toBeGreaterThan(easy * 1.3);
  expect(hard).toBeGreaterThan(normal * 1.3);
});

test("the opponent copes worse with fast balls than with slow ones", () => {
  const perRally = (power: number) => {
    const r = play("normal", 60, power);
    return r.aiHits / r.over.length;
  };
  expect(perRally(0.3)).toBeGreaterThan(perRally(0.85) * 1.2);
});

test("the opponent never breaks the two-bounce or kitchen rules", () => {
  const { over } = play("normal", 60);
  const aiFaults = over.filter(
    (e) => e.winner === 0 && (e.reason === "two-bounce-rule" || e.reason === "kitchen"),
  );
  expect(aiFaults).toEqual([]);
});
