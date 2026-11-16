import { expect, test } from "vitest";
import { COURT } from "./court";
import { Match, type MatchEvent, type MatchOptions, type Swing } from "./match";

const DT = 1 / 120;
const DRIVE: Swing = { power: 0.5, kind: "forehand" };
type Each = (m: Match) => void;
type Of<T extends MatchEvent["type"]> = Extract<MatchEvent, { type: T }>;

/** Steps the match until an event of the wanted type appears; returns every event seen. */
function until<T extends MatchEvent["type"]>(
  m: Match,
  type: T,
  each?: Each,
  max = 30,
  wanted: (e: Of<T>) => boolean = () => true,
) {
  const seen: MatchEvent[] = [];
  for (let t = 0; t < max; t += DT) {
    each?.(m);
    seen.push(...m.step(DT));
    const found = seen.find((e) => e.type === type && wanted(e as Of<T>));
    if (found) return { seen, found: found as Of<T> };
  }
  throw new Error(`no "${type}" within ${max}s; saw ${seen.map((e) => e.type).join(",")}`);
}

/** In practice the machine's feed is a hit too; this waits for the player's own. */
const playerHit = (m: Match, each: Each) => until(m, "hit", each, 30, (e) => e.side === 0);

/** A player who swings once, when the ball reaches the wanted timing (0 = perfect, + early, - late). */
function swingWhen(side: 0 | 1, timing: number, swing: Swing = DRIVE): Each {
  let done = false;
  return (m) => {
    const aim = m.aim(side);
    if (!done && aim.inReach && aim.timing <= timing) {
      m.swing(side, swing);
      done = true;
    }
  };
}

/** A player who returns every ball with perfect timing, after its bounce. */
function steady(side: 0 | 1, swing: Swing = DRIVE): Each {
  return (m) => {
    const aim = m.aim(side);
    if (m.state.bounces >= 1 && aim.inReach && aim.timing <= 0) m.swing(side, swing);
  };
}

const practice = (o: Partial<MatchOptions> = {}) => new Match({ mode: "practice", rng: () => 0.5, ...o });
const match = (o: Partial<MatchOptions> = {}) => new Match({ mode: "match", rng: () => 0.5, ...o });
const inOpponentCourt = (p: number[], hitter: 0 | 1) => {
  const depth = hitter === 0 ? -p[2] : p[2];
  return Math.abs(p[0]) <= COURT.halfWidth && depth > 0 && depth <= COURT.halfLength;
};
const serveThenWait = (m: Match) => {
  if (m.state.phase === "serve") m.swing(m.state.score.server, DRIVE);
};
const both = (...each: Each[]): Each => (m) => each.forEach((e) => e(m));

// ---- hitting a fed ball (practice) ----------------------------------------

test("in practice the ball is fed to the player, who runs to it by themselves", () => {
  const m = practice();
  const { found } = until(m, "bounce");
  expect(found.p[2]).toBeGreaterThan(0); // lands on the player's side
  playerHit(m, swingWhen(0, 0));
});

test("swinging while the ball is in reach sends it back into the far court", () => {
  const m = practice();
  playerHit(m, swingWhen(0, 0));
  const { found } = until(m, "bounce");
  expect(inOpponentCourt(found.p, 0)).toBe(true);
});

test("swinging when the ball is nowhere near is a miss and the ball carries on", () => {
  const m = practice();
  until(m, "bounce");
  m.state.players[0].x = 4; // standing well away from the ball
  m.state.players[0].z = 8;
  m.swing(0, DRIVE);
  const { seen } = until(m, "whiff");
  expect(seen.some((e) => e.type === "hit")).toBe(false);
});

test("swinging early and swinging late send the ball to opposite sides", () => {
  const landing = (timing: number) => {
    const m = practice();
    playerHit(m, swingWhen(0, timing));
    return until(m, "bounce").found.p[0];
  };
  const early = landing(0.7);
  const late = landing(-0.7);
  const onTime = landing(0);
  expect(early).toBeLessThan(-0.8); // a forehand pulled across to the left
  expect(late).toBeGreaterThan(0.8);
  expect(Math.abs(onTime)).toBeLessThan(0.5);
});

test("a harder swing makes the ball travel faster and land deeper", () => {
  const shot = (power: number) => {
    const m = practice();
    const hit = playerHit(m, swingWhen(0, 0, { power, kind: "forehand" })).found;
    const depth = -until(m, "bounce").found.p[2];
    return { speed: Math.hypot(...hit.ball.v), depth };
  };
  const soft = shot(0.1);
  const hard = shot(0.8);
  expect(hard.speed).toBeGreaterThan(soft.speed * 1.2);
  expect(hard.depth).toBeGreaterThan(soft.depth + 1.5);
});

test("after each ball a new one is fed without anyone touching the computer", () => {
  const m = practice();
  until(m, "rally-over"); // the player never swings: the ball dies
  until(m, "bounce"); // and the next one arrives
  expect(m.state.rallies).toBe(1);
});

// ---- shot types ------------------------------------------------------------

function flight(kind: Swing["kind"], arrange?: Each) {
  const m = practice();
  const hit = playerHit(m, both(arrange ?? (() => {}), swingWhen(0, 0, { power: 0.6, kind }))).found;
  let apex = 0;
  const t0 = m.time;
  const landed = until(m, "bounce", (mm) => (apex = Math.max(apex, mm.state.ball.p[1])));
  return { hit, apex, airtime: m.time - t0, events: landed.seen };
}

test("a lob flies higher and hangs longer than a drive", () => {
  const drive = flight("forehand");
  const lob = flight("lob");
  expect(lob.apex).toBeGreaterThan(drive.apex + 1.5);
  expect(lob.airtime).toBeGreaterThan(drive.airtime + 0.5);
});

test("a smash on a high ball is the fastest shot and still clears the net", () => {
  const high: Each = (m) => {
    if (m.state.lastHitter === 1) m.state.ball.p[1] = Math.max(m.state.ball.p[1], 1.9);
  };
  const smash = flight("smash", high);
  const drive = flight("forehand", high);
  expect(Math.hypot(...smash.hit.ball.v)).toBeGreaterThan(Math.hypot(...drive.hit.ball.v) * 1.3);
  expect(smash.events.some((e) => e.type === "net")).toBe(false);
});

test("a smash on a low ball goes into the net", () => {
  const m = practice();
  playerHit(m, (mm) => {
    const aim = mm.aim(0);
    if (mm.state.bounces >= 1 && aim.inReach && mm.state.ball.p[1] < 0.5) mm.swing(0, { power: 0.6, kind: "smash" });
  });
  expect(until(m, "rally-over").found.reason).toBe("net");
});

test("the stroke used is remembered so the character can act it out", () => {
  const m = practice();
  playerHit(m, swingWhen(0, 0, { power: 0.5, kind: "backhand" }));
  expect(m.state.players[0].kind).toBe("backhand");
  expect(m.state.players[0].swingAge).toBeLessThan(0.1);
});

// ---- a real match: serving, rules, scoring ---------------------------------

test("the server swings to serve, diagonally into the opposite service court", () => {
  const m = match();
  until(m, "serve-ready");
  const serverX = m.state.players[0].x;
  until(m, "hit", serveThenWait, 5);
  const bounce = until(m, "bounce").found.p;
  expect(Math.sign(bounce[0])).toBe(-Math.sign(serverX));
  expect(-bounce[2]).toBeGreaterThan(COURT.kitchen);
  expect(-bounce[2]).toBeLessThanOrEqual(COURT.halfLength);
});

test("a ball that bounces twice wins the rally for the hitter: the server scores", () => {
  const m = match();
  const over = until(m, "rally-over", serveThenWait).found;
  expect(over).toMatchObject({ winner: 0, reason: "double-bounce", score: [1, 0], server: 0 });
});

test("after scoring, the server serves from the other side", () => {
  const m = match();
  until(m, "serve-ready");
  const first = m.state.players[0].x;
  until(m, "rally-over", serveThenWait);
  until(m, "serve-ready");
  until(m, "hit", serveThenWait, 5);
  expect(Math.sign(m.state.players[0].x)).toBe(-Math.sign(first));
});

test("when the server loses the rally nobody scores and the serve changes hands", () => {
  const m = match();
  // The receiver returns; the server then lets the ball go.
  const over = until(m, "rally-over", both(serveThenWait, steady(1))).found;
  expect(over).toMatchObject({ winner: 1, score: [0, 0], server: 1 });
  expect(until(m, "serve-ready").found.server).toBe(1);
});

test("a serve hit too hard lands long and loses the serve", () => {
  const m = match();
  const over = until(m, "rally-over", (mm) => {
    if (mm.state.phase === "serve") mm.swing(0, { power: 1, kind: "forehand" });
  }).found;
  expect(over).toMatchObject({ winner: 1, reason: "out", server: 1 });
});

test("the serve must bounce before it is returned (two-bounce rule)", () => {
  const m = match();
  const volley: Each = (mm) => {
    if (mm.state.shots === 1 && mm.state.bounces === 0 && mm.aim(1).inReach) mm.swing(1, DRIVE);
  };
  // Stand the receiver where the serve passes overhead so a volley is possible.
  const crowd: Each = (mm) => {
    if (mm.state.shots === 1 && mm.state.bounces === 0) {
      mm.state.players[1].x = mm.state.ball.p[0];
      mm.state.players[1].z = mm.state.ball.p[2];
    }
  };
  const over = until(m, "rally-over", both(serveThenWait, crowd, volley)).found;
  expect(over).toMatchObject({ winner: 0, reason: "two-bounce-rule" });
});

test("the return must bounce before the server plays it (two-bounce rule)", () => {
  const m = match();
  const crowd: Each = (mm) => {
    if (mm.state.shots === 2 && mm.state.bounces === 0 && mm.state.ball.p[2] > 3) {
      mm.state.players[0].x = mm.state.ball.p[0];
      mm.state.players[0].z = mm.state.ball.p[2];
      mm.swing(0, DRIVE);
    }
  };
  const over = until(m, "rally-over", both(serveThenWait, steady(1), crowd)).found;
  expect(over).toMatchObject({ winner: 1, reason: "two-bounce-rule" });
});

test("volleying while standing in the kitchen loses the rally", () => {
  const m = match();
  const rally = both(serveThenWait, steady(1), (mm) => {
    // Third shot is played normally by the server...
    if (mm.state.shots === 2) steady(0)(mm);
    // ...then the server walks into the kitchen and volleys the fourth shot.
    if (mm.state.shots === 4 && mm.state.bounces === 0 && mm.state.ball.p[2] > 0.3) {
      mm.state.players[0].x = mm.state.ball.p[0];
      mm.state.players[0].z = 1;
      if (mm.aim(0).inReach) mm.swing(0, DRIVE);
    }
  });
  const over = until(m, "rally-over", rally).found;
  expect(over).toMatchObject({ winner: 1, reason: "kitchen" });
});

test("a long rally is possible: both players can keep returning the ball", () => {
  const m = match();
  let hits = 0;
  for (let t = 0; t < 40 && hits < 8; t += DT) {
    serveThenWait(m);
    steady(0)(m);
    steady(1)(m);
    hits += m.step(DT).filter((e) => e.type === "hit").length;
  }
  expect(hits).toBe(8);
});

test("the match ends when a player reaches 11, and swings no longer do anything", () => {
  const m = match();
  const over = until(m, "match-over", serveThenWait, 400).found;
  expect(over.winner).toBe(0);
  expect(m.state.score.points).toEqual([11, 0]);
  m.swing(0, DRIVE);
  expect(m.step(1).filter((e) => e.type === "hit")).toEqual([]);
});

test("a finished match can be played again from 0-0", () => {
  const m = match({ pointsToWin: 2 });
  until(m, "match-over", serveThenWait, 60);
  m.restart();
  expect(m.state.score.points).toEqual([0, 0]);
  until(m, "hit", serveThenWait, 5);
});
