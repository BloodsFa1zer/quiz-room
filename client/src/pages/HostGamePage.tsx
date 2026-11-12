import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConnectionBanner } from '../components/game/ConnectionBanner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Notice } from '../components/ui/Notice';
import { Screen } from '../components/ui/Screen';
import { Spinner } from '../components/ui/Spinner';
import { useConnection } from '../hooks/useConnection';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useHostRoom } from '../hooks/useHostRoom';
import { getConfig } from '../lib/api';
import { formatPin } from '../lib/format';
import { buildJoinUrl } from '../lib/joinUrl';
import { HostFinished } from '../screens/host/HostFinished';
import { HostLeaderboard } from '../screens/host/HostLeaderboard';
import { HostLobby } from '../screens/host/HostLobby';
import { HostQuestion } from '../screens/host/HostQuestion';
import { HostReveal } from '../screens/host/HostReveal';
import styles from './HostGamePage.module.css';

// Keys of a presentation: they do what the main button of the screen does.
const NEXT_KEYS = [' ', 'Enter', 'ArrowRight'];

/** `/host/:pin` — the host's game on the projector: the screen is picked by the phase of the latest snapshot. */
export function HostGamePage() {
  const { pin = '' } = useParams();
  useDocumentTitle(formatPin(pin));
  const navigate = useNavigate();
  const connected = useConnection();
  const room = useHostRoom(pin);
  // The laptop's address in the local network, for the QR code. Without it the QR uses the page's own address.
  const [lanIp, setLanIp] = useState<string | null>(null);

  useEffect(() => {
    getConfig()
      .then((config) => setLanIp(config.lanIp))
      .catch(() => setLanIp(null));
  }, []);

  const { state, next } = room;
  // The keys work only where the main button is active: not before the first snapshot, not on the
  // "game not found" card, not in an empty lobby and not after the game.
  const keysEnabled =
    state !== null &&
    !room.closed &&
    room.error === null &&
    state.phase !== 'finished' &&
    !(state.phase === 'lobby' && state.players.length === 0);

  useEffect(() => {
    if (!keysEnabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // A held key repeats keydown: without this, holding Space would run through all the phases.
      if (!NEXT_KEYS.includes(event.key) || event.repeat) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      // A focused button or field handles these keys itself; calling next() too would skip a phase.
      if (event.target instanceof Element && event.target.closest('button, input, textarea, select')) return;
      event.preventDefault();
      next(); // blocked while busy, exactly like a click
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [keysEnabled, next]);

  const goToQuizzes = () => navigate('/quizzes');

  function screen() {
    if (room.closed || room.error !== null) {
      return (
        <Screen variant="stage">
          <div className={styles.message}>
            <Card>
              <h1 className={styles.title}>Гру не знайдено</h1>
              <p className={styles.hint}>Можливо, вона вже закінчилась або сервер перезапускали.</p>
              <Button size="l" onClick={goToQuizzes}>
                До списку квізів
              </Button>
            </Card>
          </div>
        </Screen>
      );
    }

    if (state === null) {
      return (
        <Screen variant="stage">
          <p className={styles.connecting}>
            <Spinner /> Підключаємось…
          </p>
        </Screen>
      );
    }

    const common = { state, clockOffset: room.clockOffset, busy: room.busy, onNext: room.next };

    switch (state.phase) {
      case 'lobby':
        return <HostLobby {...common} joinUrl={buildJoinUrl(state.pin, lanIp)} />;
      case 'question':
        return <HostQuestion {...common} />;
      case 'reveal':
        return <HostReveal {...common} />;
      case 'leaderboard':
        return <HostLeaderboard {...common} />;
      case 'finished':
        return <HostFinished {...common} onExit={goToQuizzes} />;
    }
  }

  return (
    <>
      <ConnectionBanner connected={connected} />
      {screen()}
      {room.nextError !== null && (
        <div className={styles.nextError}>
          <Notice tone="error">{room.nextError}</Notice>
        </div>
      )}
    </>
  );
}
