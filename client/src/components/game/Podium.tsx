import type { LeaderboardEntry } from '@quiz/shared';
import { formatScore } from '../../lib/format';
import styles from './Podium.module.css';

type PodiumProps = {
  /** The winners: the first one to three rows of the leaderboard. */
  entries: LeaderboardEntry[];
};

// Left to right: 2nd, 1st, 3rd place — the winner stands in the middle.
const SLOTS = [1, 0, 2];
const STEP_CLASSES = [styles.first, styles.second, styles.third];

export function Podium({ entries }: PodiumProps) {
  return (
    <div className={styles.podium}>
      {SLOTS.map((place) => {
        const entry = entries[place];
        // With one or two players the missing places stay empty, and the winner keeps the middle.
        if (!entry) return <div key={place} />;
        return (
          <div key={place} className={styles.slot}>
            <span className={styles.name}>{entry.name}</span>
            <span className={styles.score}>{formatScore(entry.score)}</span>
            <div className={`${styles.step} ${STEP_CLASSES[place]}`}>{entry.rank}</div>
          </div>
        );
      })}
    </div>
  );
}
