import { JoinQr } from '../../components/game/JoinQr';
import { PinDisplay } from '../../components/game/PinDisplay';
import { PlayerChips } from '../../components/game/PlayerChips';
import { Button } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Screen';
import { HostHeader } from './HostHeader';
import type { HostScreenProps } from './props';
import styles from './HostLobby.module.css';

type HostLobbyProps = HostScreenProps & {
  /** Address encoded in the QR code. */
  joinUrl: string;
};

/** Phase `lobby`: how to join (QR and code) and who has already joined. */
export function HostLobby({ state, onNext, busy, joinUrl }: HostLobbyProps) {
  const playerCount = state.players.length;

  return (
    <Screen variant="stage">
      <HostHeader title={state.quizTitle}>
        <Button size="l" onClick={onNext} loading={busy} disabled={playerCount === 0}>
          Почати гру
        </Button>
      </HostHeader>

      <div className={styles.body}>
        <div className={styles.qr}>
          <JoinQr url={joinUrl} />
        </div>

        <div className={styles.side}>
          <p className={styles.label}>Код гри</p>
          <PinDisplay pin={state.pin} />
          <p className={styles.label}>Гравців: {playerCount}</p>
          {playerCount === 0 ? (
            <p className={styles.waiting}>Чекаємо на гравців…</p>
          ) : (
            <PlayerChips players={state.players} />
          )}
        </div>
      </div>
    </Screen>
  );
}
