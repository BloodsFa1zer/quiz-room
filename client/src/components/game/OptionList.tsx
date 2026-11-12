import { OptionTile, type OptionState } from './OptionTile';
import styles from './OptionList.module.css';

type OptionListProps = {
  options: string[];
  size: 'stage' | 'phone';
  /** State of every tile by option index; all tiles are `idle` when omitted. */
  states?: OptionState[];
  /** With a handler the tiles become buttons that report the chosen index. */
  onSelect?: (index: number) => void;
  disabled?: boolean;
};

/** Lays the answer options out: a 2×2 grid on the projector, one column on a phone. */
export function OptionList({ options, size, states, onSelect, disabled }: OptionListProps) {
  return (
    <div className={`${styles.list} ${styles[size]}`}>
      {options.map((text, index) => (
        <OptionTile
          // Options have no ids and never change order within a question, so the index is a stable key.
          key={index}
          index={index}
          text={text}
          size={size}
          state={states?.[index] ?? 'idle'}
          onClick={onSelect ? () => onSelect(index) : undefined}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
