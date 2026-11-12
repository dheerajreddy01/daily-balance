import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySolve, FREEZE_EVERY, fromHash, MAX_FREEZES, toHash, viewStreak, type StreakRecord } from './streak.ts';

const N = FREEZE_EVERY;
const day = (n: number) => new Date(Date.parse('2026-11-01T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const run = (len: number, from = 0) => Array.from({ length: len }, (_, i) => from + i);
const solveDays = (days: number[]) => days.reduce<StreakRecord | null>((r, d) => applySolve(r, day(d)), null)!;

test('rules: earn a freeze every 5 days in a row, hold at most 2', () => {
  assert.equal(FREEZE_EVERY, 5);
  assert.equal(MAX_FREEZES, 2);
});

test('consecutive days grow the streak and earn a freeze', () => {
  const almost = solveDays(run(N - 1));
  assert.deepEqual([almost.current, almost.freezes], [N - 1, 0]);
  const hit = applySolve(almost, day(N - 1));
  assert.deepEqual([hit.current, hit.freezes, hit.earned], [N, 1, true]);
  const next = applySolve(hit, day(N));
  assert.deepEqual([next.current, next.freezes, next.earned], [N + 1, 1, false]);
});

test('freezes cap at 2', () => {
  const r = solveDays(run(N * 3));
  assert.equal(r.current, N * 3);
  assert.equal(r.freezes, MAX_FREEZES);
  assert.equal(r.earned, false, 'no freeze earned when already full');
});

test('a missed day is covered by a freeze', () => {
  const r = solveDays(run(N));
  // Day N missed. On day N+1, before solving, the streak still shows as alive.
  assert.deepEqual(viewStreak(r, day(N + 1)), { current: N, best: N, freezes: 1, saved: 1, earned: false });
  const after = applySolve(r, day(N + 1));
  assert.deepEqual([after.current, after.freezes, after.saved], [N + 1, 0, 1]);
  assert.deepEqual(viewStreak(after, day(N + 1)), { current: N + 1, best: N + 1, freezes: 0, saved: 1, earned: false });
  assert.equal(viewStreak(after, day(N + 2)).saved, 0);
});

test('two missed days use both freezes', () => {
  const r = solveDays(run(N * 2));
  assert.equal(r.freezes, 2);
  const after = applySolve(r, day(N * 2 + 2));
  assert.deepEqual([after.current, after.freezes, after.saved], [N * 2 + 1, 0, 2]);
});

test('too many missed days resets the streak but keeps freezes', () => {
  const r = solveDays(run(N));
  assert.deepEqual(viewStreak(r, day(N + 2)), { current: 0, best: N, freezes: 1, saved: 0, earned: false });
  const after = applySolve(r, day(N + 2));
  assert.deepEqual([after.current, after.best, after.freezes, after.saved], [1, N, 1, 0]);
});

test('without freezes a missed day resets', () => {
  const r = applySolve(solveDays([0, 1, 2]), day(4));
  assert.deepEqual([r.current, r.best], [1, 3]);
});

test('solving the same day twice changes nothing', () => {
  const r = solveDays([0, 1]);
  assert.equal(applySolve(r, day(1)), r);
});

test('redis hash round trip, including records written before freezes existed', () => {
  const r = solveDays(run(N));
  assert.deepEqual(fromHash(toHash(r)), r);
  assert.deepEqual(fromHash({ last: day(3), current: '4', best: '9' }), {
    last: day(3), current: 4, best: 9, freezes: 0, saved: 0, earned: false,
  });
  assert.equal(fromHash({}), null);
});
