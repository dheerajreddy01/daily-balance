import type { CommentResponse, InitResponse, SolveRequest, SolveResponse } from '../../shared/api';

export const fetchInit = async (): Promise<InitResponse> => {
  const res = await fetch('/api/init');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as InitResponse;
};

export const postSolve = async (body: SolveRequest): Promise<SolveResponse> => {
  const res = await fetch('/api/solve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json()) as SolveResponse;
};

export const postComment = async (): Promise<CommentResponse> => {
  const res = await fetch('/api/comment', { method: 'POST' });
  return (await res.json()) as CommentResponse;
};

export const untilNextPuzzle = (): string => {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const mins = Math.max(0, Math.round((next - now.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};
