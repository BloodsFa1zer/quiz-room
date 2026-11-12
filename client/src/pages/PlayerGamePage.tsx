import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ERROR_MESSAGES } from '@quiz/shared';
import { ConnectionBanner } from '../components/game/ConnectionBanner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Screen } from '../components/ui/Screen';
import { Spinner } from '../components/ui/Spinner';
import { useConnection } from '../hooks/useConnection';
import { useCountdown } from '../hooks/useCountdown';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { usePlayerRoom } from '../hooks/usePlayerRoom';
import { formatPin } from '../lib/format';
import { clearSession } from '../lib/session';
import { PlayerAnswered } from '../screens/player/PlayerAnswered';
import { PlayerFinished } from '../screens/player/PlayerFinished';
import { PlayerLeaderboard } from '../screens/player/PlayerLeaderboard';
import { PlayerLobby } from '../screens/player/PlayerLobby';
import { PlayerQuestion } from '../screens/player/PlayerQuestion';
import { PlayerReveal } from '../screens/player/PlayerReveal';
import styles from './PlayerGamePage.module.css';

/** `/play/:pin` — the player's game: the screen is picked by the phase of the latest snapshot. */
export function PlayerGamePage() {
  const { pin = '' } = useParams();
  useDocumentTitle(formatPin(pin));
  const navigate = useNavigate();
  const connected = useConnection();
  const room = usePlayerRoom(pin);
  const { state, clockOffset } = room;
  // Only to know when the time is up; the timer itself is drawn by the screen.
  const { remainingMs } = useCountdown(state?.endsAt ?? null, clockOffset, 0);

  if (room.status === 'needs-join') return <Navigate to={`/?pin=${pin}`} replace />;

  // The game cannot go on: the room was closed, or the server refused to let this player in.
  const failure = room.closed ? 'Гру завершено' : room.error !== null ? ERROR_MESSAGES[room.error] : null;

  function screen() {
    if (failure !== null) {
      return (
        <Screen variant="phone">
          <div className={styles.message}>
            <Card>
              <h1 className={styles.title}>{failure}</h1>
              <Button size="l" fullWidth onClick={() => navigate('/')}>
                На головну
              </Button>
            </Card>
          </div>
        </Screen>
      );
    }

    if (state === null) {
      return (
        <Screen variant="phone">
          <p className={styles.connecting}>
            <Spinner /> Підключаємось…
          </p>
        </Screen>
      );
    }

    const common = { state, clockOffset };
    // The answer from the server, or the one just tapped while the server confirms it.
    const answerIndex = state.myAnswer ?? room.pendingAnswer;

    switch (state.phase) {
      case 'lobby':
        return <PlayerLobby {...common} />;
      case 'question':
        return answerIndex === null ? (
          <PlayerQuestion {...common} onAnswer={room.answer} locked={remainingMs === 0} />
        ) : (
          <PlayerAnswered {...common} answerIndex={answerIndex} />
        );
      case 'reveal':
        return <PlayerReveal {...common} />;
      case 'leaderboard':
        return <PlayerLeaderboard {...common} />;
      case 'finished':
        return (
          <PlayerFinished
            {...common}
            onExit={() => {
              clearSession();
              navigate('/');
            }}
          />
        );
    }
  }

  return (
    <>
      <ConnectionBanner connected={connected} />
      {screen()}
    </>
  );
}
