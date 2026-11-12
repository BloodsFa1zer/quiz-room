import { OptionList } from '../../components/game/OptionList';
import { TimerBar } from '../../components/game/TimerBar';
import { Button } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Screen';
import { useCountdown } from '../../hooks/useCountdown';
import { HostHeader } from './HostHeader';
import type { HostScreenProps } from './props';
import styles from './HostQuestion.module.css';

// Longer questions get a smaller font, so that they still leave room for the options.
const LONG_QUESTION = 100;

/** Phase `question`: the question, the timer, the options and how many players have answered. */
export function HostQuestion({ state, clockOffset, onNext, busy }: HostScreenProps) {
  const { question } = state;
  const totalMs = (question?.timeLimitSec ?? 0) * 1000;
  const { secondsLeft, fraction } = useCountdown(state.endsAt, clockOffset, totalMs);

  if (question === null) return null;

  return (
    <Screen variant="stage">
      <HostHeader title={`Питання ${state.questionIndex + 1} з ${state.questionCount}`}>
        <Button variant="secondary" size="l" onClick={onNext} loading={busy}>
          Завершити питання
        </Button>
      </HostHeader>

      <h2 className={question.text.length > LONG_QUESTION ? `${styles.question} ${styles.long}` : styles.question}>
        {question.text}
      </h2>

      <TimerBar fraction={fraction} secondsLeft={secondsLeft} />

      <div className={styles.options}>
        <OptionList options={question.options} size="stage" />
      </div>

      {/* Counted against all players, also the disconnected ones, so N never exceeds M. */}
      <p className={styles.answered}>
        Відповіли: {state.answeredCount} з {state.players.length}
      </p>
    </Screen>
  );
}
