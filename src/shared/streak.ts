// Daily streak rules, including streak freezes. Pure functions so the server and tests share them.
//
// - Solving today's puzzle on its day (UTC) extends the streak by 1.
// - Every FREEZE_EVERY (5) days in a row earns a streak freeze, up to MAX_FREEZES (2) held.
// - Missed days are covered automatically, one freeze per missed day, as long as there are enough.
// - If there are not enough freezes, the streak restarts at 1 and the freezes are kept.

export const FREEZE_EVERY = 5;
export const MAX_FREEZES = 2;

export type StreakRecord = {
  last: string; // last day solved, YYYY-MM-DD
  current: number;
  best: number;
  freezes: number;
  saved: number; // freezes spent on the `last` solve
  earned: boolean; // a freeze was earned on the `last` solve
};

export type Streak = {
  current: number;
  best: number;
  freezes: number; // freezes held right now
  saved: number; // freezes used (or about to be used, if not solved yet today) to keep the streak alive
  earned: boolean; // today's solve earned a freeze
};

export const EMPTY_STREAK: Streak = { current: 0, best: 0, freezes: 0, saved: 0, earned: false };

export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

// The streak as a player sees it on `today`, before or after solving.
export const viewStreak = (r: StreakRecord | null, today: string): Streak => {
  if (!r) return EMPTY_STREAK;
  const gap = daysBetween(r.last, today);
  if (gap <= 0) return { current: r.current, best: r.best, freezes: r.freezes, saved: r.saved, earned: r.earned };
  const missed = gap - 1;
  if (missed === 0) return { current: r.current, best: r.best, freezes: r.freezes, saved: 0, earned: false };
  if (missed <= r.freezes)
    // Still alive: solving today will spend `missed` freezes.
    return { current: r.current, best: r.best, freezes: r.freezes, saved: missed, earned: false };
  return { current: 0, best: r.best, freezes: r.freezes, saved: 0, earned: false };
};

// The record after solving `day`'s puzzle on that day.
export const applySolve = (r: StreakRecord | null, day: string): StreakRecord => {
  if (r && daysBetween(r.last, day) <= 0) return r;
  const prev = r ?? { last: '', current: 0, best: 0, freezes: 0, saved: 0, earned: false };
  const missed = r ? daysBetween(r.last, day) - 1 : 0;
  const alive = r !== null && missed <= prev.freezes;
  const current = alive ? prev.current + 1 : 1;
  const saved = alive ? missed : 0;
  let freezes = prev.freezes - saved;
  const earned = current % FREEZE_EVERY === 0 && freezes < MAX_FREEZES;
  if (earned) freezes += 1;
  return { last: day, current, best: Math.max(prev.best, current), freezes, saved, earned };
};

export const toHash = (r: StreakRecord): Record<string, string> => ({
  last: r.last,
  current: String(r.current),
  best: String(r.best),
  freezes: String(r.freezes),
  saved: String(r.saved),
  earned: r.earned ? '1' : '0',
});

export const fromHash = (h: Record<string, string>): StreakRecord | null =>
  h.last
    ? {
        last: h.last,
        current: Number(h.current ?? 0),
        best: Number(h.best ?? 0),
        freezes: Number(h.freezes ?? 0),
        saved: Number(h.saved ?? 0),
        earned: h.earned === '1',
      }
    : null;
