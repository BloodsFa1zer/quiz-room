import styles from './Confetti.module.css';

const PIECE_COUNT = 40;

/**
 * Pieces of colour falling over the final screen; pure CSS, no library.
 * Positions and timings come from the index instead of Math.random, so every render is the same:
 * 37 and 100 have no common divisor, so the 40 pieces get 40 different places across the width.
 */
export function Confetti() {
  return (
    <div className={styles.confetti} aria-hidden="true">
      {Array.from({ length: PIECE_COUNT }, (_, index) => (
        <span
          key={index}
          className={styles.piece}
          style={{
            left: `${(index * 37) % 100}%`,
            animationDelay: `${(index % 8) * 0.3}s`,
            animationDuration: `${3 + (index % 5) * 0.4}s`,
          }}
        />
      ))}
    </div>
  );
}
