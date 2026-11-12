import { context, redis } from '@devvit/web/server';
import { dayKey } from '../../shared/puzzle';

export const today = (): string => dayKey(new Date());

// Each post plays the day it was created for, so old posts stay playable.
export const postDay = async (): Promise<string> => {
  const fromData = context.postData?.day;
  if (typeof fromData === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fromData)) return fromData;
  if (context.postId) {
    const stored = await redis.get(`post:${context.postId}:day`);
    if (stored) return stored;
  }
  return today();
};
