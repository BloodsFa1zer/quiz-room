import styles from './Spinner.module.css';

/** Loading indicator. Its size follows the font size of the parent (1em). */
export function Spinner() {
  return <span className={styles.spinner} role="status" aria-label="Завантаження" />;
}
