import type { Placed } from './puzzle';
import type { Streak } from './streak';

export type { Streak };

export type DayResult = {
  moves: number;
  hints: number;
  seconds: number;
  score: number;
  board: Placed[];
};

export type Standing = {
  solvers: number;
  rank: number | null;
  perfect: number;
  spread: Record<string, number>; // score -> players
  top: { name: string; score: number; seconds: number }[];
};

export type InitResponse = {
  type: 'init';
  day: string;
  today: string;
  username: string | null;
  result: DayResult | null;
  streak: Streak;
  standing: Standing;
};

export type SolveRequest = {
  day: string;
  board: Placed[];
  moves: number;
  hints: number;
  seconds: number;
};

export type SolveResponse =
  | { type: 'solve'; result: DayResult; streak: Streak; standing: Standing }
  | { type: 'error'; message: string };

export type CommentResponse = { type: 'comment'; ok: boolean; message: string };
