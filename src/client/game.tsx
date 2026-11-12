import './index.css';

import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { showLoginPrompt, showShareSheet, showToast } from '@devvit/web/client';
import type { DayResult, InitResponse, Standing, Streak } from '../shared/api';
import { LEVELS, makePuzzle, torque, type Placed, type Puzzle } from '../shared/puzzle';
import { FREEZE_EVERY, MAX_FREEZES } from '../shared/streak';
import { Beam, WeightIcon, type BeamWeight } from './Beam';
import { fetchInit, ordinal, postComment, postSolve, untilNextPuzzle } from './lib/api';

type Item = { id: number; w: number; pos: number | null };

const freshItems = (p: Puzzle): Item[] => p.tray.map((w, id) => ({ id, w, pos: null }));

const stamp = (ref: { current: number | null }) => {
  if (ref.current === null) ref.current = Date.now();
};

const elapsed = (ref: { current: number | null }) =>
  Math.max(1, Math.round((Date.now() - (ref.current ?? Date.now())) / 1000));

const Spread = ({ standing, mine }: { standing: Standing; mine: number }) => {
  const rows = Object.entries(standing.spread)
    .map(([s, n]) => [Number(s), n] as const)
    .sort((a, b) => a[0] - b[0])
    .slice(0, 6);
  const max = Math.max(1, ...rows.map((r) => r[1]));
  if (rows.length === 0) return null;
  return (
    <div className="spread" aria-label="How everyone scored today">
      {rows.map(([score, n]) => (
        <div key={score} className={`spread-row ${score === mine ? 'mine' : ''}`}>
          <span className="spread-score">{score}</span>
          <span className="spread-bar" style={{ width: `${Math.max(6, (n / max) * 100)}%` }} />
          <span className="spread-n">{n}</span>
        </div>
      ))}
    </div>
  );
};

const HowTo = ({ puzzle, onClose }: { puzzle: Puzzle; onClose: () => void }) => (
  <section className="howto" aria-label="How to play">
    <h2 className="howto-h">How to play</h2>
    <ol className="steps">
      <li>
        <b>Tap a gold weight</b> under the beam to pick it up.
      </li>
      <li>
        <b>Tap a spot on the beam</b> to set it down. Tap it again on the beam to move it.
      </li>
      <li>
        <b>Make the beam level</b> with every gold weight on it. The grey weights can’t be moved.
      </li>
    </ol>
    <p className="example">
      Weights farther from the middle push down harder. A <b>4</b> on spot <b>3</b> counts as 4 × 3 = <b>12</b>. The
      numbers below the beam show each side’s total. Make them match.
    </p>
    <h3 className="howto-h3">Your score</h3>
    <p>
      Each time you set a weight down, that’s one move. A perfect game uses one move per weight ({puzzle.tray.length}{' '}
      today). A hint places one weight for you and adds 2. Lower is better. There’s no rush and no time limit.
    </p>
    <h3 className="howto-h3">Difficulty</h3>
    <table className="levels">
      <tbody>
        {LEVELS.map((l) => (
          <tr key={l.level} className={l.level === puzzle.level ? 'now' : ''}>
            <td>
              <span className={`level-tag ${l.level.toLowerCase()}`}>{l.level}</span>
            </td>
            <td>{l.days}</td>
            <td>{l.tray} weights to place</td>
          </tr>
        ))}
      </tbody>
    </table>
    <h3 className="howto-h3">Daily streak</h3>
    <p>
      Solve the new puzzle each day to keep your streak going. A new puzzle arrives every day at midnight UTC.
    </p>
    <p>
      <b>Streak freezes:</b> every {FREEZE_EVERY} days in a row earns a freeze (you can hold {MAX_FREEZES}). If you miss
      a day, a freeze is used automatically and your streak survives. Miss more days than you have freezes and the streak
      starts over.
    </p>
    <div className="actions">
      <button className="btn primary" onClick={onClose}>
        Let’s play
      </button>
    </div>
  </section>
);

const HELP_SEEN = 'daily-balance:help-seen';

const helpSeen = (): boolean => {
  try {
    return localStorage.getItem(HELP_SEEN) === '1';
  } catch {
    return true;
  }
};

const markHelpSeen = () => {
  try {
    localStorage.setItem(HELP_SEEN, '1');
  } catch {
    // Storage blocked; the help just shows again next time.
  }
};

const formatTime = (s: number): string => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const streakNote = (streak: Streak, isToday: boolean, loggedIn: boolean): string => {
  if (!loggedIn) return 'Log in to keep a daily streak.';
  if (!isToday) return 'Only today’s puzzle counts toward your streak.';
  const parts: string[] = [];
  if (streak.saved > 0)
    parts.push(
      streak.saved === 1
        ? 'A streak freeze covered the day you missed.'
        : `${streak.saved} streak freezes covered the days you missed.`
    );
  if (streak.earned) parts.push(`${streak.current} days in a row! You earned a streak freeze.`);
  parts.push(`Come back tomorrow for day ${streak.current + 1}.`);
  return parts.join(' ');
};

const ResultCard = ({
  puzzle,
  result,
  streak,
  standing,
  isToday,
  loggedIn,
}: {
  puzzle: Puzzle;
  result: DayResult;
  streak: Streak;
  standing: Standing;
  isToday: boolean;
  loggedIn: boolean;
}) => {
  const par = puzzle.tray.length;
  const perfect = result.moves === par && result.hints === 0;
  const [commented, setCommented] = useState(false);

  const share = async () => {
    const hints = result.hints ? `, ${result.hints} hint${result.hints > 1 ? 's' : ''}` : '';
    await showShareSheet({
      title: `Daily Balance #${puzzle.number}`,
      text: `I balanced Daily Balance #${puzzle.number} in ${result.moves} moves (perfect is ${par}${hints}). Can you?`,
    });
  };

  const comment = async () => {
    const res = await postComment();
    showToast(res.message);
    if (res.ok) setCommented(true);
  };

  return (
    <section className="result" aria-live="polite">
      <p className="result-kicker">{perfect ? 'Perfect! Not a single wasted move.' : 'Nice work, you balanced it!'}</p>
      <h2 className="result-head">{plural(result.moves, 'move')}</h2>
      <p className="result-par">
        {perfect
          ? `The fewest possible: one move per weight.`
          : `A perfect game takes ${par}. Try for fewer tomorrow.`}
      </p>
      <dl className="facts">
        <div>
          <dt>Time</dt>
          <dd>{formatTime(result.seconds)}</dd>
        </div>
        <div>
          <dt>Hints used</dt>
          <dd>{result.hints}</dd>
        </div>
        <div>
          <dt>Day streak</dt>
          <dd>{loggedIn ? streak.current : '–'}</dd>
        </div>
        <div>
          <dt>Freezes</dt>
          <dd>{loggedIn ? `${streak.freezes}/${MAX_FREEZES}` : '–'}</dd>
        </div>
        <div>
          <dt>Place</dt>
          <dd>{standing.rank ? `${ordinal(standing.rank)} of ${standing.solvers}` : '–'}</dd>
        </div>
      </dl>
      <p className="streak-note">{streakNote(streak, isToday, loggedIn)}</p>
      <p className="score-note">
        Your score: <b>{result.score}</b>
        {result.hints > 0 ? ` (${plural(result.moves, 'move')} + ${result.hints} hint${result.hints > 1 ? 's' : ''} × 2)` : ''}.
        Lower is better.
      </p>
      {standing.solvers > 1 && (
        <>
          <p className="spread-title">How everyone scored today (your score in gold)</p>
          <Spread standing={standing} mine={result.score} />
        </>
      )}
      <div className="actions">
        {loggedIn ? (
          <button className="btn primary" onClick={comment} disabled={commented}>
            {commented ? 'Commented' : 'Comment my result'}
          </button>
        ) : (
          <button className="btn primary" onClick={() => showLoginPrompt()}>
            Log in to save
          </button>
        )}
        <button className="btn" onClick={share}>
          Share
        </button>
      </div>
      <p className="next">{isToday ? `New puzzle in ${untilNextPuzzle()}` : `This was the puzzle for ${puzzle.day}.`}</p>
    </section>
  );
};

export const App = () => {
  const [init, setInit] = useState<InitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [held, setHeld] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [hints, setHints] = useState(0);
  const [lastDrop, setLastDrop] = useState<number | null>(null);
  const [done, setDone] = useState<{ result: DayResult; streak: Streak; standing: Standing } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(() => !helpSeen());
  const started = useRef<number | null>(null);

  useEffect(() => {
    fetchInit()
      .then((data) => {
        const p = makePuzzle(data.day);
        if (data.result) {
          setDone({ result: data.result, streak: data.streak, standing: data.standing });
          setItems(data.result.board.map((b, id) => ({ id, w: b.w, pos: b.pos })));
        } else {
          setItems(freshItems(p));
        }
        setInit(data);
      })
      .catch(() => setError('Could not load today’s puzzle. Close and reopen the post to try again.'));
  }, []);

  const puzzle = useMemo(() => (init ? makePuzzle(init.day) : null), [init]);

  const placed: Placed[] = useMemo(
    () => items.filter((i) => i.pos !== null).map((i) => ({ pos: i.pos ?? 0, w: i.w })),
    [items]
  );
  const net = puzzle ? torque([...puzzle.fixed, ...placed]) : 0;
  const allPlaced = puzzle !== null && items.length > 0 && items.every((i) => i.pos !== null);
  const level = allPlaced && net === 0;

  const leftForce = puzzle
    ? -[...puzzle.fixed, ...placed].filter((p) => p.pos < 0).reduce((s, p) => s + p.w * p.pos, 0)
    : 0;
  const rightForce = puzzle
    ? [...puzzle.fixed, ...placed].filter((p) => p.pos > 0).reduce((s, p) => s + p.w * p.pos, 0)
    : 0;

  const tick = () => {
    stamp(started);
    setSaveError(null);
  };

  const submit = useCallback(
    async (board: Placed[], m: number, h: number) => {
      if (!init) return;
      const seconds = elapsed(started);
      if (!init.username) {
        const result: DayResult = { moves: m, hints: h, seconds, score: m + h * 2, board };
        setDone({ result, streak: init.streak, standing: init.standing });
        return;
      }
      setSaving(true);
      setSaveError(null);
      const res = await postSolve({ day: init.day, board, moves: m, hints: h, seconds }).catch(() => null);
      setSaving(false);
      if (!res || res.type === 'error') {
        // Stop the auto-submit loop; the player can retry or move a weight.
        setSaveError(res?.message ?? 'Could not save your result. Check your connection.');
        return;
      }
      setDone({ result: res.result, streak: res.streak, standing: res.standing });
    },
    [init]
  );

  useEffect(() => {
    if (level && !done && !saving && !saveError) {
      const t = window.setTimeout(() => void submit(placed, moves, hints), 650);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [level, done, saving, saveError, placed, moves, hints, submit]);

  if (error) return <main className="shell center"><p className="error">{error}</p></main>;
  if (!init || !puzzle) return <main className="shell center"><p className="muted">Setting up the beam…</p></main>;

  const locked = done !== null || saving;

  const pick = (id: number) => {
    if (locked) return;
    tick();
    setHeld((h) => (h === id ? null : id));
  };

  const pickFromBeam = (key: string) => {
    if (locked) return;
    const id = Number(key.slice(1));
    tick();
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, pos: null } : x)));
    setHeld(id);
  };

  const dropOn = (pos: number) => {
    if (locked) return;
    if (held === null) {
      showToast('Pick a weight from the tray first.');
      return;
    }
    tick();
    setItems((xs) => xs.map((x) => (x.id === held ? { ...x, pos } : x)));
    setMoves((m) => m + 1);
    setLastDrop(held);
    setHeld(null);
  };

  const reset = () => {
    if (locked) return;
    setSaveError(null);
    setItems((xs) => xs.map((x) => ({ ...x, pos: null })));
    setHeld(null);
  };

  const hint = () => {
    if (locked) return;
    tick();
    const target = puzzle.solution.find((s) => !items.some((i) => i.pos === s.pos && i.w === s.w));
    if (!target) return;
    const cleared = items.map((x) => (x.pos === target.pos ? { ...x, pos: null } : x));
    const mover =
      cleared.find((x) => x.pos === null && x.w === target.w) ??
      cleared.find((x) => x.w === target.w && !puzzle.solution.some((s) => s.pos === x.pos && s.w === x.w));
    if (!mover) return;
    setItems(cleared.map((x) => (x.id === mover.id ? { ...x, pos: target.pos } : x)));
    setLastDrop(mover.id);
    setHints((h) => h + 1);
    setHeld(null);
  };

  const beamWeights: BeamWeight[] = [
    ...puzzle.fixed.map((f) => ({ key: `f${f.pos}`, pos: f.pos, w: f.w, fixed: true })),
    ...items
      .filter((i) => i.pos !== null)
      .map((i) => ({ key: `t${i.id}`, pos: i.pos ?? 0, w: i.w, fixed: false, fresh: i.id === lastDrop })),
  ];
  const tray = items.filter((i) => i.pos === null);
  const isToday = init.day === init.today;
  const streak = done?.streak ?? init.streak;
  const left = tray.length;
  const gap = Math.abs(leftForce - rightForce);
  const status = level
    ? 'Level!'
    : net === 0
      ? placed.length === 0
        ? 'Even'
        : 'Even so far'
      : `${net > 0 ? 'Right' : 'Left'} is heavier by ${gap}`;
  const heldItem = items.find((i) => i.id === held);
  const coach = heldItem
    ? `Now tap a spot on the beam to put the ${heldItem.w} there.`
    : left === 0
      ? `All weights are on, but it isn’t level yet. Tap a weight on the beam to move it.`
      : placed.length === 0
        ? `Tap a gold weight below to pick it up. Make both sides match.`
        : net === 0
          ? `Even so far. Place the last ${plural(left, 'weight')} and keep it even.`
          : `Pick up the next weight. ${plural(left, 'weight')} left to place.`;

  return (
    <main className="shell">
      <header className="top">
        <div>
          <h1 className="title">Daily Balance</h1>
          <p className="sub">
            #{puzzle.number} <span className={`level-tag ${puzzle.level.toLowerCase()}`}>{puzzle.level}</span>
          </p>
        </div>
        <div className="counter" aria-label={`${moves} moves so far. A perfect game takes ${puzzle.tray.length}.`}>
          <span className="counter-n">{done ? done.result.moves : moves}</span>
          <span className="counter-l">moves · perfect is {puzzle.tray.length}</span>
        </div>
      </header>
      <div className="meta">
        <span
          className="streak-chip"
          aria-label={`Streak ${streak.current} days, best ${streak.best}, ${streak.freezes} streak freezes`}
        >
          {!init.username
            ? 'Log in to keep a streak'
            : streak.current > 0
              ? `${streak.current}-day streak · ${plural(streak.freezes, 'freeze')}`
              : streak.best > 0
                ? `No streak right now · best ${streak.best}`
                : 'Solve today to start a streak'}
        </span>
        <button
          className="link"
          onClick={() => {
            if (showHelp) markHelpSeen();
            setShowHelp((v) => !v);
          }}
          aria-expanded={showHelp}
        >
          {showHelp ? 'Close help' : 'How to play'}
        </button>
      </div>

      {init.username && !done && streak.saved > 0 && streak.current > 0 && (
        <p className="freeze-note" role="status">
          You missed {streak.saved === 1 ? 'a day' : `${streak.saved} days`}. Solve today and{' '}
          {streak.saved === 1 ? 'a streak freeze' : `${streak.saved} streak freezes`} will keep your {streak.current}-day
          streak alive.
        </p>
      )}

      <section className="stage">
        <Beam
          weights={beamWeights}
          net={net}
          level={level}
          armed={held !== null}
          onPeg={locked ? undefined : dropOn}
          onWeight={locked ? undefined : pickFromBeam}
        />
        <div className="forces" aria-hidden={done !== null}>
          <span className={`force ${leftForce > rightForce ? 'heavy' : ''}`}>
            {leftForce}
            <small>left side</small>
          </span>
          <span className="forces-mid">{status}</span>
          <span className={`force right ${rightForce > leftForce ? 'heavy' : ''}`}>
            {rightForce}
            <small>right side</small>
          </span>
        </div>
      </section>

      {showHelp ? (
        <HowTo
          puzzle={puzzle}
          onClose={() => {
            markHelpSeen();
            setShowHelp(false);
          }}
        />
      ) : level && !done ? (
        <section className="win" aria-live="assertive">
          <p className="win-head">Level! You solved it.</p>
          {saveError ? (
            <>
              <p className="error">{saveError}</p>
              <div className="actions">
                <button className="btn primary" onClick={() => void submit(placed, moves, hints)} disabled={saving}>
                  Try again
                </button>
              </div>
            </>
          ) : (
            <p className="muted">{init.username ? 'Saving your result…' : 'Tallying your result…'}</p>
          )}
        </section>
      ) : done ? (
        <ResultCard
          puzzle={puzzle}
          result={done.result}
          streak={done.streak}
          standing={done.standing}
          isToday={isToday}
          loggedIn={init.username !== null}
        />
      ) : (
        <>
          <p className="rule" aria-live="polite">
            {coach}
          </p>
          <div className="tray" role="group" aria-label="Weights to place">
            {tray.map((i) => (
              <button
                key={i.id}
                className={`tray-wt ${held === i.id ? 'held' : ''}`}
                onClick={() => pick(i.id)}
                aria-pressed={held === i.id}
                aria-label={`Weight ${i.w}`}
              >
                <WeightIcon w={i.w} />
              </button>
            ))}
          </div>
          <div className="actions">
            <button className="btn" onClick={hint} disabled={locked}>
              Hint (adds 2)
            </button>
            <button className="btn" onClick={reset} disabled={locked || placed.length === 0}>
              Take all off
            </button>
          </div>
        </>
      )}
    </main>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
