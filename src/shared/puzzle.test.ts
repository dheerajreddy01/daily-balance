import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSolution, countSolutions, dayNumber, levelFor, makePuzzle, torque } from './puzzle.ts';

test('puzzles are deterministic and solvable for a year of days', () => {
  const start = Date.parse('2026-11-11');
  for (let i = 0; i < 365; i++) {
    const day = new Date(start + i * 86400000).toISOString().slice(0, 10);
    const a = makePuzzle(day);
    const b = makePuzzle(day);
    assert.deepEqual(a, b);
    assert.equal(torque([...a.fixed, ...a.solution]), 0);
    assert.notEqual(torque(a.fixed), 0);
    assert.ok(checkSolution(a, a.solution).ok);
    assert.equal(countSolutions(a.fixed, a.tray), a.solutions);
  }
});

test('day numbers start at 1 on launch', () => {
  assert.equal(dayNumber('2026-11-11'), 1);
  assert.equal(dayNumber('2026-11-12'), 2);
});

test('rejects bad boards', () => {
  const p = makePuzzle('2026-12-01');
  assert.equal(checkSolution(p, p.solution.slice(1)).ok, false);
  const moved = p.solution.map((s, i) => (i === 0 ? { ...s, pos: p.fixed[0]!.pos } : s));
  assert.equal(checkSolution(p, moved).ok, false);
});

test('levels follow the weekday', () => {
  assert.equal(levelFor('2026-11-16').level, 'Light'); // Mon
  assert.equal(levelFor('2026-11-17').level, 'Light'); // Tue
  assert.equal(levelFor('2026-11-18').level, 'Steady'); // Wed
  assert.equal(levelFor('2026-11-20').level, 'Steady'); // Fri
  assert.equal(levelFor('2026-11-21').level, 'Heavy'); // Sat
  assert.equal(levelFor('2026-11-22').level, 'Heavy'); // Sun
  assert.equal(makePuzzle('2026-11-21').tray.length, 5);
});
