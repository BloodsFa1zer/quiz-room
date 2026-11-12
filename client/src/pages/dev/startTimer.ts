import type { HostState, PlayerState } from '@quiz/shared';

/**
 * For the `question` phase: sets the snapshot time to "now" and the deadline one time limit ahead,
 * so the timer of a fixture starts running at the moment the fixture is opened in the gallery.
 */
export function startTimer<T extends HostState | PlayerState>(state: T): T {
  if (state.phase !== 'question' || state.question === null) return state;
  const now = Date.now();
  return { ...state, serverNow: now, endsAt: now + state.question.timeLimitSec * 1000 };
}
