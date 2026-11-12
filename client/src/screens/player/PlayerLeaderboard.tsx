import { LeaderboardList } from '../../components/game/LeaderboardList';
import { PlayerHeader } from '../../components/game/PlayerHeader';
import { Screen } from '../../components/ui/Screen';
import { formatPoints, formatScore } from '../../lib/format';
import type { PlayerScreenProps } from './props';
import styles from './PlayerLeaderboard.module.css';

/** Phase `leaderboard`: the player's place, the top five and, below it, the player's own row. */
export function PlayerLeaderboard({ state }: PlayerScreenProps) {
  const { me, top } = state;
  const inTop = top.some((entry) => entry.playerId === me.id);

  return (
    <Screen variant="phone">
      <PlayerHeader name={me.name} score={me.score} />

      <div className={styles.summary}>
        <h1 className={styles.place}>Ти на {me.rank} місці</h1>
        <p className={styles.score}>{formatPoints(me.score)}</p>
      </div>

      <div className={styles.table}>
        <LeaderboardList entries={top} highlightId={me.id} />
        {!inTop && (
          <p className={styles.myRow}>
            {me.rank}. Ти — {formatScore(me.score)}
          </p>
        )}
      </div>
    </Screen>
  );
}
