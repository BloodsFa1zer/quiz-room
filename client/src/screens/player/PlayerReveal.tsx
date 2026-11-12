import { useEffect } from 'react';
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

// One pulse for a right answer, two for a wrong one (or none): the result is felt before it is read.
const VIBRATE_CORRECT = 200;
const VIBRATE_WRONG = [120, 100, 120];

/** Phase `reveal`: whether the player's answer was right and, if not, which one was. */
export function PlayerReveal({ state }: PlayerScreenProps) {
  const { question, correctIndex, lastResult } = state;
  const correct = lastResult?.correct ?? null;

  useEffect(() => {
    if (correct === null) return;
    // A page may vibrate only after the player has touched it; earlier (e.g. right after a refresh)
    // Chrome blocks the call and logs an error. Where there is no API at all (iPhone), `?.` skips it.
    if (!navigator.userActivation?.hasBeenActive) return;
    navigator.vibrate?.(correct ? VIBRATE_CORRECT : VIBRATE_WRONG);
  }, [correct]);

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
