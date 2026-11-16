import { useEffect, useState } from 'react';
import { Spinner } from '../ui/Spinner';
import styles from './ConnectionBanner.module.css';

type ConnectionBannerProps = {
  /** Whether the socket is connected right now; the page takes it from `useConnection()`. */
  connected: boolean;
};

// A short wait: the very first connection and quick reconnects should not make the banner flash.
const SHOW_AFTER_MS = 1000;

/**
 * A card in the middle of the dimmed screen while the connection to the server is lost.
 * Not a strip at the top: that one covered the host's title and the player's name and score.
 */
export function ConnectionBanner({ connected }: ConnectionBannerProps) {
  const [waitedEnough, setWaitedEnough] = useState(false);

  useEffect(() => {
    if (connected) return;
    const id = setTimeout(() => setWaitedEnough(true), SHOW_AFTER_MS);
    return () => {
      clearTimeout(id);
      setWaitedEnough(false);
    };
  }, [connected]);

  if (connected || !waitedEnough) return null;

  return (
    <div className={styles.overlay} role="alert">
      <div className={styles.card}>
        <span className={styles.spinner}>
          <Spinner />
        </span>
        <p className={styles.title}>Зʼєднання втрачено</p>
        <p>Перепідключаємось…</p>
      </div>
    </div>
  );
}
