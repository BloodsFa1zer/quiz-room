import { OPTION_LETTERS } from '@quiz/shared';
import styles from './AnswerBars.module.css';

type AnswerBarsProps = {
  options: string[];
  /** Number of answers per option, same order as `options`. */
  answerCounts: number[];
  correctIndex: number;
};

/** Bar chart of the answers: one bar per option, the correct one stands out. */
export function AnswerBars({ options, answerCounts, correctIndex }: AnswerBarsProps) {
  // The tallest bar fills the chart. At least 1, so "nobody answered" does not divide by zero.
  const max = Math.max(1, ...answerCounts);

  return (
    <div className={styles.bars}>
      {options.map((_, index) => {
        const count = answerCounts[index] ?? 0;
        const isCorrect = index === correctIndex;
        return (
          <div key={index} className={isCorrect ? `${styles.column} ${styles.correct}` : styles.column}>
            <div className={styles.track}>
              <div className={`${styles.bar} ${styles[`opt${index}`]}`} style={{ height: `${(count / max) * 100}%` }}>
                <span className={styles.count}>
                  {isCorrect && '✓ '}
                  {count}
                </span>
              </div>
            </div>
            <span className={`${styles.letter} ${styles[`opt${index}`]}`}>{OPTION_LETTERS[index]}</span>
          </div>
        );
      })}
    </div>
  );
}
