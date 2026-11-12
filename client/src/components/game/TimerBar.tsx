import styles from './TimerBar.module.css';

type TimerBarProps = {
  /** Share of the time that is left: 1 — just started, 0 — time is up. */
  fraction: number;
  secondsLeft: number;
};

// The last seconds are shown in the warning colour.
const WARNING_SECONDS = 5;

/** A shrinking bar with the number of seconds left. Values come from `useCountdown`. */
export function TimerBar({ fraction, secondsLeft }: TimerBarProps) {
  const className = secondsLeft <= WARNING_SECONDS ? `${styles.timer} ${styles.warning}` : styles.timer;

  return (
    <div className={className}>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${fraction * 100}%` }} />
      </div>
      <span className={styles.seconds}>{secondsLeft}</span>
    </div>
  );
}
