import { AnswerBars } from '../../components/game/AnswerBars';
import { OptionList } from '../../components/game/OptionList';
import { Button } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Screen';
import { HostHeader } from './HostHeader';
import type { HostScreenProps } from './props';
import styles from './HostReveal.module.css';

// Longer questions get a smaller font, so that they still leave room for the chart.
const LONG_QUESTION = 100;

/** Phase `reveal`: the correct answer and how the answers were split between the options. */
export function HostReveal({ state, onNext, busy }: HostScreenProps) {
  const { question, answerCounts, correctIndex } = state;

  if (question === null || answerCounts === null || correctIndex === null) return null;

  return (
    <Screen variant="stage">
      <HostHeader title={`Питання ${state.questionIndex + 1} з ${state.questionCount}`}>
        <Button size="l" onClick={onNext} loading={busy}>
          Далі
        </Button>
      </HostHeader>

      <h2 className={question.text.length > LONG_QUESTION ? `${styles.question} ${styles.long}` : styles.question}>
        {question.text}
      </h2>

      <div className={styles.bars}>
        <AnswerBars options={question.options} answerCounts={answerCounts} correctIndex={correctIndex} />
      </div>

      <div className={styles.options}>
        <OptionList
          options={question.options}
          size="stage"
          states={question.options.map((_, index) => (index === correctIndex ? 'correct' : 'dimmed'))}
        />
      </div>
    </Screen>
  );
}
