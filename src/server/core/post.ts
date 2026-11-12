import { context, reddit, redis } from '@devvit/web/server';
import { makePuzzle } from '../../shared/puzzle';
import { today } from './day';

export const createPost = async (day: string = today()) => {
  const puzzle = makePuzzle(day);
  const post = await reddit.submitCustomPost({
    title: `Daily Balance #${puzzle.number}: ${puzzle.level} (${day})`,
    postData: { day },
    textFallback: { text: `Daily Balance #${puzzle.number}. Open this post on new Reddit or the app to play.` },
  });
  await redis.set(`post:${post.id}:day`, day);
  await redis.set(`sub:${context.subredditName}:latest`, post.id);
  return post;
};
