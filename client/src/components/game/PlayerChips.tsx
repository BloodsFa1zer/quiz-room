import type { PlayerInfo } from '@quiz/shared';
import styles from './PlayerChips.module.css';

type PlayerChipsProps = { players: PlayerInfo[] };

/** Names of the players in the room as chips. Disconnected players are shown faded. */
export function PlayerChips({ players }: PlayerChipsProps) {
  return (
    <ul className={styles.chips}>
      {players.map((player) => (
        <li key={player.id} className={player.connected ? styles.chip : `${styles.chip} ${styles.offline}`}>
          {player.name}
        </li>
      ))}
    </ul>
  );
}
