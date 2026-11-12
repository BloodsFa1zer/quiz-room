import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConnectionBanner } from '../components/game/ConnectionBanner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Notice } from '../components/ui/Notice';
import { Screen } from '../components/ui/Screen';
import { Spinner } from '../components/ui/Spinner';
import { useConnection } from '../hooks/useConnection';
import { useHostRoom } from '../hooks/useHostRoom';
import { getConfig } from '../lib/api';
import { buildJoinUrl } from '../lib/joinUrl';
import { HostFinished } from '../screens/host/HostFinished';
import { HostLeaderboard } from '../screens/host/HostLeaderboard';
import { HostLobby } from '../screens/host/HostLobby';
import { HostQuestion } from '../screens/host/HostQuestion';
import { HostReveal } from '../screens/host/HostReveal';
import styles from './HostGamePage.module.css';

/** `/host/:pin` — the host's game on the projector: the screen is picked by the phase of the latest snapshot. */
export function HostGamePage() {
  const { pin = '' } = useParams();
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

    const { state } = room;
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
