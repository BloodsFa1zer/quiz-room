import type { LeaderboardEntry } from '@quiz/shared';
import { formatScore } from '../../lib/format';
import styles from './LeaderboardList.module.css';

// Rows appear one after another, this far apart. After ten rows the rest come in together,
// so a long final table does not keep the audience waiting.
const ROW_DELAY_MS = 70;
const DELAYED_ROWS = 10;

type LeaderboardListProps = {
  /** Already sorted and ranked by the server. */
  entries: LeaderboardEntry[];
  /** Id of the player whose row is highlighted (the player's own row on a phone). */
  highlightId?: string;
  /** Show `+850` next to the players who earned points for the last question. */
  showDelta?: boolean;
};

/** Rows "place · name · score". The font size follows the parent, so it fits a projector and a phone. */
export function LeaderboardList({ entries, highlightId, showDelta = false }: LeaderboardListProps) {
  return (
    <ol className={styles.list}>
      {entries.map((entry, index) => (
        <li
          key={entry.playerId}
          className={entry.playerId === highlightId ? `${styles.row} ${styles.highlight}` : styles.row}
          style={{ animationDelay: `${Math.min(index, DELAYED_ROWS) * ROW_DELAY_MS}ms` }}
        >
          <span className={styles.rank}>{entry.rank}</span>
          <span className={styles.name}>{entry.name}</span>
          {showDelta && entry.lastPoints > 0 && (
            <span className={styles.delta}>+{formatScore(entry.lastPoints)}</span>
          )}
          <span className={styles.score}>{formatScore(entry.score)}</span>
        </li>
      ))}
    </ol>
  );
}
