import { OPTION_LETTERS } from '@quiz/shared';
import styles from './OptionTile.module.css';

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed';

type OptionTileProps = {
  /** Option index 0..3: picks the colour and the letter A–D. */
  index: number;
  text: string;
  size: 'stage' | 'phone';
  state: OptionState;
  /** How many players chose this option. */
  count?: number;
  /** With a handler the tile is a button (player screens); without one it is a plain block. */
  onClick?: () => void;
  disabled?: boolean;
};

// Longer texts get a smaller font, so that three lines are enough for them.
const LONG_TEXT = 40;

export function OptionTile({ index, text, size, state, count, onClick, disabled = false }: OptionTileProps) {
  const className = [
    styles.tile,
    styles[`opt${index}`],
    styles[size],
    styles[state],
    text.length > LONG_TEXT ? styles.long : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className={styles.letter}>{OPTION_LETTERS[index]}</span>
      <span className={styles.text}>{text}</span>
      {count !== undefined && <span className={styles.count}>{count}</span>}
      {state === 'correct' && <span className={styles.mark}>✓</span>}
      {state === 'wrong' && <span className={styles.mark}>✗</span>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} disabled={disabled}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}
