import { useState } from 'react';
import type { HostState } from '@quiz/shared';
import { buildJoinUrl } from '../../lib/joinUrl';
import { HostFinished } from '../../screens/host/HostFinished';
import { HostLeaderboard } from '../../screens/host/HostLeaderboard';
import { HostLobby } from '../../screens/host/HostLobby';
import { HostQuestion } from '../../screens/host/HostQuestion';
import { HostReveal } from '../../screens/host/HostReveal';
import { startTimer } from './startTimer';

type HostPreviewProps = { fixture: HostState };

/**
 * Shows a host fixture the way the real host page does: the screen is picked by `state.phase`.
 * There is no server behind the gallery, so the callbacks only write to the console.
 */
export function HostPreview({ fixture }: HostPreviewProps) {
  // Runs once, when the fixture is opened: the timer of a question starts at that moment.
  const [state] = useState(() => startTimer(fixture));

  const common = {
    state,
    // The snapshot is "sent" by this very browser, so its clock and the server clock are the same.
    clockOffset: 0,
    busy: false,
    onNext: () => console.info('[dev] onNext'),
  };

  switch (state.phase) {
    case 'lobby':
      return <HostLobby {...common} joinUrl={buildJoinUrl(state.pin, null)} />;
    case 'question':
      return <HostQuestion {...common} />;
    case 'reveal':
      return <HostReveal {...common} />;
    case 'leaderboard':
      return <HostLeaderboard {...common} />;
    case 'finished':
      return <HostFinished {...common} onExit={() => console.info('[dev] onExit')} />;
  }
}
