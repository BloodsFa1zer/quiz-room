import { PlayerHeader } from '../../components/game/PlayerHeader';
import { Screen } from '../../components/ui/Screen';
import { formatScore } from '../../lib/format';
import type { PlayerScreenProps } from './props';
import styles from './PlayerReveal.module.css';

/** What the card says for each outcome; the colour comes from the CSS class of the same name. */
const OUTCOMES = {
  correct: { icon: '✓', title: 'Правильно!' },
  wrong: { icon: '✗', title: 'Неправильно' },
  timeout: { icon: '⏱', title: 'Час вийшов' },
};

/** Phase `reveal`: whether the player's answer was right and, if not, which one was. */
export function PlayerReveal({ state }: PlayerScreenProps) {
  const { question, correctIndex, lastResult } = state;

  if (question === null || correctIndex === null || lastResult === null) return null;

  // The server has already judged the answer: the client only picks the words for it.
  const outcome = lastResult.correct ? 'correct' : state.myAnswer === null ? 'timeout' : 'wrong';
  const { icon, title } = OUTCOMES[outcome];

  return (
    <Screen variant="phone">
      <PlayerHeader name={state.me.name} score={state.me.score} />

      <div className={`${styles.card} ${styles[outcome]}`}>
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
        <h1 className={styles.title}>{title}</h1>
        {lastResult.correct ? (
          <p className={styles.points}>+{formatScore(lastResult.points)}</p>
        ) : (
          <p className={styles.answer}>
            Правильна відповідь: <strong>{question.options[correctIndex]}</strong>
          </p>
        )}
      </div>
    </Screen>
  );
}
