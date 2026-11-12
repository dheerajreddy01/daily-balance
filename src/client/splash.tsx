import './index.css';

import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { requestExpandedMode } from '@devvit/web/client';
import type { InitResponse } from '../shared/api';
import { makePuzzle, torque } from '../shared/puzzle';
import { Beam } from './Beam';
import { fetchInit, untilNextPuzzle } from './lib/api';

export const Splash = () => {
  const [init, setInit] = useState<InitResponse | null>(null);
  useEffect(() => {
    fetchInit().then(setInit).catch(() => setInit(null));
  }, []);
  const puzzle = useMemo(() => (init ? makePuzzle(init.day) : null), [init]);

  const weights = puzzle
    ? init?.result
      ? [
          ...puzzle.fixed.map((f) => ({ key: `f${f.pos}`, pos: f.pos, w: f.w, fixed: true })),
          ...init.result.board.map((b, i) => ({ key: `t${i}`, pos: b.pos, w: b.w, fixed: false })),
        ]
      : puzzle.fixed.map((f) => ({ key: `f${f.pos}`, pos: f.pos, w: f.w, fixed: true }))
    : [];
  const net = puzzle ? (init?.result ? 0 : torque(puzzle.fixed)) : 0;
  const solved = Boolean(init?.result);

  return (
    <main className="shell splash">
      <header className="top">
        <div>
          <h1 className="title">Daily Balance</h1>
          {puzzle && (
            <p className="sub">
              #{puzzle.number} <span className={`level-tag ${puzzle.level.toLowerCase()}`}>{puzzle.level}</span>
            </p>
          )}
        </div>
        {init && init.streak.current > 0 && (
          <div className="counter">
            <span className="counter-n">{init.streak.current}</span>
            <span className="counter-l">day streak</span>
          </div>
        )}
      </header>
      <div className="stage">
        <Beam weights={weights} net={net} level={solved} armed={false} compact />
      </div>
      <p className="pitch">
        {solved
          ? `You balanced it in ${init?.result?.moves} moves. Next puzzle in ${untilNextPuzzle()}.`
          : puzzle
            ? `Place ${puzzle.tray.length} weights so the beam sits level.`
            : 'Level the beam with every weight.'}
      </p>
      <div className="actions">
        <button className="btn primary big" onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}>
          {solved ? 'See results' : puzzle ? `Play #${puzzle.number}` : 'Play'}
        </button>
      </div>
      {init && init.standing.solvers > 0 && (
        <p className="muted small">
          {init.standing.solvers} {init.standing.solvers === 1 ? 'player has' : 'players have'} balanced it today
        </p>
      )}
    </main>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
