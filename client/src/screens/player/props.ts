import type { PlayerState } from '@quiz/shared';

/** Props that every player screen receives. The page (or the /dev gallery) picks the screen by `state.phase`. */
export type PlayerScreenProps = {
  state: PlayerState;
  /** `serverNow - Date.now()` of the latest snapshot; needed to draw the timer. */
  clockOffset: number;
};
