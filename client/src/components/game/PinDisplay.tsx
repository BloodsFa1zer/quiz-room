import styles from './PinDisplay.module.css';

type PinDisplayProps = { pin: string };

/** The game code in huge digits, split in the middle (`123 456`) so it is easy to read aloud. */
export function PinDisplay({ pin }: PinDisplayProps) {
  const middle = Math.ceil(pin.length / 2);

  return (
    <p className={styles.pin}>
      <span>{pin.slice(0, middle)}</span>
      <span>{pin.slice(middle)}</span>
    </p>
  );
}
