import { MAX_POINTS, MIN_POINTS } from '@quiz/shared';

/**
 * Points for a correct answer (docs/00-common.md §6.6): an instant answer gets MAX_POINTS,
 * an answer at the very last moment gets MIN_POINTS, linearly in between.
 */
export function calcPoints(elapsedMs: number, limitMs: number): number {
  const ratio = Math.min(Math.max(elapsedMs / limitMs, 0), 1);
  return Math.round(MAX_POINTS - (MAX_POINTS - MIN_POINTS) * ratio);
}
