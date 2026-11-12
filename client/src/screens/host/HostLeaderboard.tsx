import { LEADERBOARD_SIZE } from '@quiz/shared';
import { LeaderboardList } from '../../components/game/LeaderboardList';
import { Button } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Screen';
import { HostHeader } from './HostHeader';
import type { HostScreenProps } from './props';
import styles from './HostLeaderboard.module.css';

/** Phase `leaderboard`: the best players after the question and the points they have just earned. */
export function HostLeaderboard({ state, onNext, busy }: HostScreenProps) {
  return (
    <Screen variant="stage">
      <HostHeader title="Таблиця лідерів">
        <Button size="l" onClick={onNext} loading={busy}>
          Наступне питання
        </Button>
      </HostHeader>

      <div className={styles.board}>
        <LeaderboardList entries={state.leaderboard.slice(0, LEADERBOARD_SIZE)} showDelta />
      </div>
    </Screen>
  );
}
