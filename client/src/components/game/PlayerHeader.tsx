import { formatPoints } from '../../lib/format';
import styles from './PlayerHeader.module.css';

type PlayerHeaderProps = {
  name: string;
  score: number;
};

/** Narrow strip on top of the player screens: who is playing and how many points they have. */
export function PlayerHeader({ name, score }: PlayerHeaderProps) {
  return (
    <header className={styles.header}>
      <span className={styles.name}>{name}</span>
      <span className={styles.score}>{formatPoints(score)}</span>
    </header>
  );
}
