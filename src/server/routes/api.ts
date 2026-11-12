import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type { CommentResponse, InitResponse, SolveRequest, SolveResponse } from '../../shared/api';
import { checkSolution, makePuzzle, scoreOf } from '../../shared/puzzle';
import { postDay, today } from '../core/day';
import { getResult, getStanding, getStreak, saveResult } from '../core/stats';
import { EMPTY_STREAK } from '../../shared/streak';

export const api = new Hono();

api.get('/init', async (c) => {
  const day = await postDay();
  const now = today();
  const username = (await reddit.getCurrentUsername()) ?? null;
  const [result, streak, standing] = await Promise.all([
    username ? getResult(day, username) : Promise.resolve(null),
    username ? getStreak(username, now) : Promise.resolve(EMPTY_STREAK),
    getStanding(day, username),
  ]);
  return c.json<InitResponse>({ type: 'init', day, today: now, username, result, streak, standing });
});

api.post('/solve', async (c) => {
  const body = await c.req.json<SolveRequest>();
  const day = await postDay();
  const username = await reddit.getCurrentUsername();
  if (!username) return c.json<SolveResponse>({ type: 'error', message: 'Log in to save your result.' }, 401);
  if (body.day !== day) return c.json<SolveResponse>({ type: 'error', message: 'This post is for a different day.' }, 400);

  const puzzle = makePuzzle(day);
  const check = checkSolution(puzzle, body.board);
  if (!check.ok) return c.json<SolveResponse>({ type: 'error', message: check.reason }, 400);

  const moves = Math.max(puzzle.tray.length, Math.floor(body.moves));
  const hints = Math.max(0, Math.min(puzzle.tray.length, Math.floor(body.hints)));
  const seconds = Math.max(1, Math.min(99999, Math.floor(body.seconds)));
  const result = { moves, hints, seconds, score: scoreOf(moves, hints), board: body.board };

  await saveResult(day, today(), username, result);
  const [saved, streak, standing] = await Promise.all([
    getResult(day, username),
    getStreak(username, today()),
    getStanding(day, username),
  ]);
  return c.json<SolveResponse>({ type: 'solve', result: saved ?? result, streak, standing });
});

// Posts the player's result as a comment from their own account.
api.post('/comment', async (c) => {
  const day = await postDay();
  const username = await reddit.getCurrentUsername();
  const postId = context.postId;
  if (!username || !postId) return c.json<CommentResponse>({ type: 'comment', ok: false, message: 'Log in to comment.' });
  const result = await getResult(day, username);
  if (!result) return c.json<CommentResponse>({ type: 'comment', ok: false, message: 'Solve the puzzle first.' });
  const puzzle = makePuzzle(day);
  const par = puzzle.tray.length;
  const hintText = result.hints ? ` with ${result.hints} hint${result.hints > 1 ? 's' : ''}` : '';
  const text = `Balanced #${puzzle.number} in ${result.moves} moves (perfect is ${par})${hintText}, ${result.seconds}s.`;
  try {
    await reddit.submitComment({ id: postId, text, runAs: 'USER' });
    return c.json<CommentResponse>({ type: 'comment', ok: true, message: 'Comment posted.' });
  } catch (err) {
    console.error('comment failed', err);
    return c.json<CommentResponse>({ type: 'comment', ok: false, message: 'Could not post the comment.' });
  }
});
