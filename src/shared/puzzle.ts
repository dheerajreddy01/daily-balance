// Daily Balance puzzle engine. Shared by client (play) and server (verify).
// A beam has pegs at distances 1..REACH on each side of the pivot.
// Turning force of a weight = weight x signed distance. Balanced when the sum is 0.

export const REACH = 5;
export const LAUNCH_DAY = '2026-11-11';

export type Placed = { pos: number; w: number };

export type Puzzle = {
  day: string;
  number: number;
  level: Level;
  fixed: Placed[];
  tray: number[];
  solution: Placed[];
  solutions: number;
};

export type Level = 'Light' | 'Steady' | 'Heavy';

export const PEGS: number[] = [
  ...Array.from({ length: REACH }, (_, i) => -(REACH - i)),
  ...Array.from({ length: REACH }, (_, i) => i + 1),
];

// mulberry32, seeded from a string hash, so every player gets the same puzzle.
const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

export const dayNumber = (day: string): number =>
  Math.round((Date.parse(day) - Date.parse(LAUNCH_DAY)) / 86400000) + 1;

export const torque = (placed: Placed[]): number =>
  placed.reduce((sum, p) => sum + p.w * p.pos, 0);

export type LevelSpec = {
  level: Level;
  days: string;
  weekdays: number[]; // 0 Sun .. 6 Sat, UTC
  tray: number; // brass weights the player places
  fixed: number; // iron weights already on the beam
  maxSolutions: number; // fewer valid answers = harder
};

// Difficulty rises through the week. This table is the single source of truth for the game and the help panel.
export const LEVELS: LevelSpec[] = [
  { level: 'Light', days: 'Mon–Tue', weekdays: [1, 2], tray: 3, fixed: 1, maxSolutions: 4 },
  { level: 'Steady', days: 'Wed–Fri', weekdays: [3, 4, 5], tray: 4, fixed: 2, maxSolutions: 3 },
  { level: 'Heavy', days: 'Sat–Sun', weekdays: [6, 0], tray: 5, fixed: 2, maxSolutions: 2 },
];

export const levelFor = (day: string): LevelSpec => {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return LEVELS.find((l) => l.weekdays.includes(weekday)) ?? LEVELS[LEVELS.length - 1]!;
};

// Count distinct ways to place every tray weight on the free pegs so the beam balances.
export const countSolutions = (fixed: Placed[], tray: number[], cap = 50): number => {
  const free = PEGS.filter((p) => !fixed.some((f) => f.pos === p));
  const base = torque(fixed);
  const sorted = [...tray].sort((a, b) => b - a);
  const seen = new Set<string>();
  const used = new Array<boolean>(free.length).fill(false);
  const picks: Placed[] = [];

  const walk = (i: number, sum: number) => {
    if (seen.size >= cap) return;
    if (i === sorted.length) {
      if (sum === 0) {
        seen.add(
          [...picks]
            .sort((a, b) => a.pos - b.pos)
            .map((p) => `${p.pos}:${p.w}`)
            .join(',')
        );
      }
      return;
    }
    const w = sorted[i]!;
    for (let j = 0; j < free.length; j++) {
      if (used[j]) continue;
      used[j] = true;
      picks.push({ pos: free[j]!, w });
      walk(i + 1, sum + w * free[j]!);
      picks.pop();
      used[j] = false;
    }
  };
  walk(0, base);
  return seen.size;
};

export const makePuzzle = (day: string): Puzzle => {
  const cfg = levelFor(day);
  const rand = rng(hash(`daily-balance:${day}`));
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const shuffle = <T>(a: T[]): T[] => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [b[i], b[j]] = [b[j]!, b[i]!];
    }
    return b;
  };

  let fallback: Puzzle | undefined;
  for (let attempt = 0; attempt < 6000; attempt++) {
    const slots = shuffle(PEGS).slice(0, cfg.fixed + cfg.tray);
    const trayPlaced: Placed[] = slots.slice(0, cfg.tray).map((pos) => ({ pos, w: int(1, 9) }));
    const fixedPos = slots.slice(cfg.tray);
    const fixed: Placed[] = fixedPos.slice(0, -1).map((pos) => ({ pos, w: int(1, 9) }));
    const lastPos = fixedPos[fixedPos.length - 1]!;
    const rest = torque([...trayPlaced, ...fixed]);
    if (rest % lastPos !== 0) continue;
    const lastW = -rest / lastPos;
    if (lastW < 1 || lastW > 9) continue;
    fixed.push({ pos: lastPos, w: lastW });

    // The fixed weights alone must tip the beam, or there is no puzzle.
    if (torque(fixed) === 0) continue;
    const tray = shuffle(trayPlaced.map((p) => p.w));
    const solutions = countSolutions(fixed, tray, 12);
    const candidate: Puzzle = {
      day,
      number: dayNumber(day),
      level: cfg.level,
      fixed: fixed.sort((a, b) => a.pos - b.pos),
      tray,
      solution: trayPlaced.sort((a, b) => a.pos - b.pos),
      solutions,
    };
    if (solutions >= 1 && solutions <= cfg.maxSolutions) return candidate;
    if (solutions >= 1 && (!fallback || solutions < fallback.solutions)) fallback = candidate;
  }
  // Rarely no puzzle hits the target; use the tightest one found instead.
  if (fallback) return fallback;
  throw new Error(`No puzzle found for ${day}`);
};

export type CheckResult = { ok: true } | { ok: false; reason: string };

// Server-side check that a submitted board is a real solution to the day's puzzle.
export const checkSolution = (puzzle: Puzzle, placed: Placed[]): CheckResult => {
  if (placed.length !== puzzle.tray.length) return { ok: false, reason: 'Every weight must be on the beam.' };
  const positions = new Set<number>();
  for (const p of placed) {
    if (!PEGS.includes(p.pos)) return { ok: false, reason: 'Weight placed off the beam.' };
    if (puzzle.fixed.some((f) => f.pos === p.pos)) return { ok: false, reason: 'Peg already taken.' };
    if (positions.has(p.pos)) return { ok: false, reason: 'Two weights on one peg.' };
    positions.add(p.pos);
  }
  const a = [...placed.map((p) => p.w)].sort().join(',');
  const b = [...puzzle.tray].sort().join(',');
  if (a !== b) return { ok: false, reason: 'Weights do not match the day.' };
  if (torque([...puzzle.fixed, ...placed]) !== 0) return { ok: false, reason: 'The beam is not level.' };
  return { ok: true };
};

export const scoreOf = (moves: number, hints: number): number => moves + hints * 2;
