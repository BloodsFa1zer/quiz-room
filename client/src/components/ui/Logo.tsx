import styles from './Logo.module.css';

/** Text logo. Its size follows the font size of the parent, so it fits both a phone and a projector. */
export function Logo() {
  return (
    <span className={styles.logo}>
      Quiz<span className={styles.accent}>Room</span>
    </span>
  );
}
