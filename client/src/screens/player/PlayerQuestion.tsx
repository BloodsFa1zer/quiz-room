import { OptionList } from '../../components/game/OptionList';
import { PlayerHeader } from '../../components/game/PlayerHeader';
import { TimerBar } from '../../components/game/TimerBar';
import { Screen } from '../../components/ui/Screen';
import { useCountdown } from '../../hooks/useCountdown';
import type { PlayerScreenProps } from './props';
import styles from './PlayerQuestion.module.css';

type PlayerQuestionProps = PlayerScreenProps & {
  /** The player tapped an option. */
  onAnswer: (index: number) => void;
  /** Time is up: the buttons stay blocked until the server sends the `reveal` snapshot. */
  locked: boolean;
};

// Longer questions get a smaller font, so that they leave the screen to the buttons.
const LONG_QUESTION = 100;

/** Phase `question` before the player has answered: the question, the timer and the answer buttons. */
export function PlayerQuestion({ state, clockOffset, onAnswer, locked }: PlayerQuestionProps) {
  const { question } = state;
  const totalMs = (question?.timeLimitSec ?? 0) * 1000;
  const { secondsLeft, fraction } = useCountdown(state.endsAt, clockOffset, totalMs);

  if (question === null) return null;

  return (
    // `fit`: the screen is exactly one phone screen high and the buttons share what is left of it.
    <Screen variant="phone" fit>
      <PlayerHeader name={state.me.name} score={state.me.score} />

      <p className={styles.counter}>
        Питання {state.questionIndex + 1} з {state.questionCount}
      </p>
      <h1 className={question.text.length > LONG_QUESTION ? `${styles.question} ${styles.long}` : styles.question}>
        {question.text}
      </h1>

      {locked ? <p className={styles.timeUp}>Час вийшов</p> : <TimerBar fraction={fraction} secondsLeft={secondsLeft} />}

      <div className={styles.options}>
        <OptionList options={question.options} size="phone" onSelect={onAnswer} disabled={locked} />
      </div>
    </Screen>
  );
}
