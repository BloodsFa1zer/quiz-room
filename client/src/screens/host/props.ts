import type { HostState } from '@quiz/shared';

/** Props that every host screen receives. The page (or the /dev gallery) picks the screen by `state.phase`. */
export type HostScreenProps = {
  state: HostState;
  /** `serverNow - Date.now()` of the latest snapshot; needed to draw the timer. */
  clockOffset: number;
  /** The host pressed the main button: the server moves the game one step forward. */
  onNext: () => void;
  /** A `host:next` request is in flight: the button is blocked until the server answers. */
  busy: boolean;
};
