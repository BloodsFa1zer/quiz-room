import { useState } from 'react';
import type { PlayerState } from '@quiz/shared';
import { PlayerAnswered } from '../../screens/player/PlayerAnswered';
import { PlayerFinished } from '../../screens/player/PlayerFinished';
import { PlayerLeaderboard } from '../../screens/player/PlayerLeaderboard';
import { PlayerLobby } from '../../screens/player/PlayerLobby';
import { PlayerQuestion } from '../../screens/player/PlayerQuestion';
import { PlayerReveal } from '../../screens/player/PlayerReveal';
import { startTimer } from './startTimer';

type PlayerPreviewProps = {
  fixture: PlayerState;
  /** `question` phase only: the buttons as they are after the time has run out. */
  locked?: boolean;
};

/**
 * Shows a player fixture the way the real player page does: the screen is picked by `state.phase`.
 * There is no server behind the gallery, so the callbacks only write to the console.
 */
export function PlayerPreview({ fixture, locked = false }: PlayerPreviewProps) {
  // Runs once, when the fixture is opened: the timer of a question starts at that moment.
  const [state] = useState(() => startTimer(fixture));

  // The snapshot is "sent" by this very browser, so its clock and the server clock are the same.
  const common = { state, clockOffset: 0 };

  switch (state.phase) {
    case 'lobby':
      return <PlayerLobby {...common} />;
    case 'question':
      // Once there is an answer, the player waits for the others instead of seeing the buttons.
      return state.myAnswer === null ? (
        <PlayerQuestion {...common} locked={locked} onAnswer={(index) => console.info('[dev] onAnswer', index)} />
      ) : (
        <PlayerAnswered {...common} answerIndex={state.myAnswer} />
      );
    case 'reveal':
      return <PlayerReveal {...common} />;
    case 'leaderboard':
      return <PlayerLeaderboard {...common} />;
    case 'finished':
      return <PlayerFinished {...common} onExit={() => console.info('[dev] onExit')} />;
  }
}
