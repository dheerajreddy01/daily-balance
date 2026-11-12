import { redis } from '@devvit/web/server';
import type { DayResult, Standing } from '../../shared/api';
import { applySolve, fromHash, toHash, viewStreak, type Streak } from '../../shared/streak';

const k = {
  results: (d: string) => `day:${d}:results`,
  board: (d: string) => `day:${d}:board`,
  spread: (d: string) => `day:${d}:spread`,
  perfect: (d: string) => `day:${d}:perfect`,
  streak: (u: string) => `user:${u}:streak`,
};

// Lower is better: score first, then time.
const rankScore = (r: DayResult) => r.score * 100000 + Math.min(r.seconds, 99999);

export const getResult = async (day: string, user: string): Promise<DayResult | null> => {
  const raw = await redis.hGet(k.results(day), user);
  return raw ? (JSON.parse(raw) as DayResult) : null;
};

export const getStreak = async (user: string, today: string): Promise<Streak> =>
  viewStreak(fromHash(await redis.hGetAll(k.streak(user))), today);

const bumpStreak = async (user: string, day: string, today: string): Promise<void> => {
  if (day !== today) return; // only playing on the day counts toward a streak
  const before = fromHash(await redis.hGetAll(k.streak(user)));
  const after = applySolve(before, day);
  if (after !== before) await redis.hSet(k.streak(user), toHash(after));
};

export const saveResult = async (day: string, today: string, user: string, r: DayResult): Promise<boolean> => {
  const isNew = await redis.hSetNX(k.results(day), user, JSON.stringify(r));
  if (!isNew) return false;
  await redis.zAdd(k.board(day), { member: user, score: rankScore(r) });
  await redis.hIncrBy(k.spread(day), String(r.score), 1);
  if (r.hints === 0 && r.moves === r.board.length) await redis.incrBy(k.perfect(day), 1);
  await bumpStreak(user, day, today);
  return true;
};

export const getStanding = async (day: string, user: string | null): Promise<Standing> => {
  const [solvers, spreadRaw, perfectRaw, topRaw, rank] = await Promise.all([
    redis.zCard(k.board(day)),
    redis.hGetAll(k.spread(day)),
    redis.get(k.perfect(day)),
    redis.zRange(k.board(day), 0, 4, { by: 'rank' }),
    user ? redis.zRank(k.board(day), user) : Promise.resolve(undefined),
  ]);
  const spread: Record<string, number> = {};
  for (const [score, n] of Object.entries(spreadRaw)) spread[score] = Number(n);
  return {
    solvers,
    rank: typeof rank === 'number' ? rank + 1 : null,
    perfect: Number(perfectRaw ?? 0),
    spread,
    top: topRaw.map((t) => ({
      name: t.member,
      score: Math.floor(t.score / 100000),
      seconds: t.score % 100000,
    })),
  };
};
