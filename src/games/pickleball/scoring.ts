import { other, type Side } from "./court";

/** Singles side-out scoring: only the server can score. */
export interface Score {
  points: [number, number];
  server: Side;
  winner: Side | null;
}

export const newScore = (firstServer: Side = 0): Score => ({
  points: [0, 0],
  server: firstServer,
  winner: null,
});

export function rallyWon(score: Score, winner: Side, pointsToWin = 11): Score {
  if (score.winner !== null) return score;
  if (winner !== score.server) return { ...score, server: other(score.server) };
  const points: [number, number] = [...score.points];
  points[winner]++;
  const lead = points[winner] - points[other(winner)];
  const won = points[winner] >= pointsToWin && lead >= 2;
  return { points, server: score.server, winner: won ? winner : null };
}

/** The server stands on the right when their own score is even. */
export const servesFromRight = (score: Score) => score.points[score.server] % 2 === 0;
