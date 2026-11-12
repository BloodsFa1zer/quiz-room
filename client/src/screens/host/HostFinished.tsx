import { LeaderboardList } from '../../components/game/LeaderboardList';
import { Podium } from '../../components/game/Podium';
import { Button } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Screen';
import { HostHeader } from './HostHeader';
import type { HostScreenProps } from './props';
import styles from './HostFinished.module.css';

type HostFinishedProps = HostScreenProps & {
  /** Leave the game: the page takes the host back to the quiz list. */
  onExit: () => void;
};

const PODIUM_PLACES = 3;

/** Phase `finished`: the podium of the winners and the final table of all players. */
export function HostFinished({ state, onExit }: HostFinishedProps) {
  return (
    <Screen variant="stage">
      <HostHeader title="Гру завершено!">
        <Button variant="secondary" size="l" onClick={onExit}>
          До списку квізів
        </Button>
      </HostHeader>

      <div className={styles.body}>
        <Podium entries={state.leaderboard.slice(0, PODIUM_PLACES)} />
        <div className={styles.table}>
          <LeaderboardList entries={state.leaderboard} />
        </div>
      </div>
    </Screen>
  );
}
