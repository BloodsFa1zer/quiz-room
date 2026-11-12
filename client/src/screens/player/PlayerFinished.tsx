import { PlayerHeader } from '../../components/game/PlayerHeader';
import { Button } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Screen';
import { formatPoints } from '../../lib/format';
import type { PlayerScreenProps } from './props';
import styles from './PlayerFinished.module.css';

type PlayerFinishedProps = PlayerScreenProps & {
  /** Leave the game: the page forgets this player and goes back to the entry page. */
  onExit: () => void;
};

// Medals for the first three places, by rank − 1.
const MEDALS = ['🥇', '🥈', '🥉'];

/** Phase `finished`: the player's final place and score. */
export function PlayerFinished({ state, onExit }: PlayerFinishedProps) {
  const { me } = state;
  const medal = me.rank <= MEDALS.length ? MEDALS[me.rank - 1] : null;

  return (
    <Screen variant="phone">
      <PlayerHeader name={me.name} score={me.score} />

      <div className={styles.body}>
        <h1 className={styles.title}>Гру завершено!</h1>
        {medal !== null && (
          <span className={styles.medal} role="img" aria-label={`Медаль за ${me.rank} місце`}>
            {medal}
          </span>
        )}
        <p className={styles.place}>
          Твоє місце: {me.rank} з {state.playerCount}
        </p>
        <p className={styles.score}>{formatPoints(me.score)}</p>
      </div>

      <Button size="l" fullWidth onClick={onExit}>
        Грати ще
      </Button>
    </Screen>
  );
}
