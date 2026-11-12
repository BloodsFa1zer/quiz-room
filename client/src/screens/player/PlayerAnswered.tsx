import { OptionTile } from '../../components/game/OptionTile';
import { PlayerHeader } from '../../components/game/PlayerHeader';
import { Screen } from '../../components/ui/Screen';
import { Spinner } from '../../components/ui/Spinner';
import type { PlayerScreenProps } from './props';
import styles from './PlayerAnswered.module.css';

type PlayerAnsweredProps = PlayerScreenProps & {
  /** The option the player chose: from the snapshot, or the one just tapped while the server confirms it. */
  answerIndex: number;
};

/** Phase `question` after the player has answered: the chosen option and waiting for the others. */
export function PlayerAnswered({ state, answerIndex }: PlayerAnsweredProps) {
  const { question } = state;

  if (question === null) return null;

  return (
    <Screen variant="phone">
      <PlayerHeader name={state.me.name} score={state.me.score} />

      <div className={styles.body}>
        <h1 className={styles.title}>Відповідь прийнято</h1>
        <OptionTile index={answerIndex} text={question.options[answerIndex]} size="phone" state="selected" />
        <p className={styles.waiting}>
          <Spinner />
          Чекаємо на інших…
        </p>
      </div>
    </Screen>
  );
}
