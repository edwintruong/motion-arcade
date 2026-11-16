import { expect, test } from "vitest";
import { newScore, rallyWon, servesFromRight, type Score } from "./scoring";

function after(score: Score, ...winners: (0 | 1)[]) {
  return winners.reduce((s, w) => rallyWon(s, w), score);
}

test("the server winning a rally scores a point and keeps serving", () => {
  const score = rallyWon(newScore(0), 0);
  expect(score.points).toEqual([1, 0]);
  expect(score.server).toBe(0);
});

test("the receiver winning a rally scores nothing but takes the serve", () => {
  const score = rallyWon(newScore(0), 1);
  expect(score.points).toEqual([0, 0]);
  expect(score.server).toBe(1);
});

test("the server serves from the right on an even score and the left on an odd one", () => {
  expect(servesFromRight(newScore(0))).toBe(true);
  expect(servesFromRight(rallyWon(newScore(0), 0))).toBe(false);
});

test("the game is won at 11 points", () => {
  const score = after(newScore(0), ...Array<0>(11).fill(0));
  expect(score.points).toEqual([11, 0]);
  expect(score.winner).toBe(0);
});

test("at 10-10 the game goes on until someone leads by two", () => {
  let score: Score = { points: [10, 10], server: 0, winner: null };
  score = rallyWon(score, 0);
  expect(score.points).toEqual([11, 10]);
  expect(score.winner).toBeNull();
  score = rallyWon(score, 0);
  expect(score.points).toEqual([12, 10]);
  expect(score.winner).toBe(0);
});

test("nothing changes once the game is won", () => {
  const won: Score = { points: [11, 3], server: 0, winner: 0 };
  expect(rallyWon(won, 1)).toEqual(won);
});
