import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../ui/Button';
import styles from './JoinQr.module.css';

type JoinQrProps = {
  /** Full address of the join page, e.g. the result of `buildJoinUrl`. */
  url: string;
};

type CopyStatus = 'idle' | 'copied' | 'failed';

const COPY_LABELS: Record<CopyStatus, string> = {
  idle: 'Скопіювати посилання',
  copied: 'Скопійовано ✓',
  failed: 'Не вдалося скопіювати',
};

// How long the button reports the result of a copy before it offers to copy again.
const STATUS_MS = 2000;

/** QR code of the join address with the same address in text for those who cannot scan it. */
export function JoinQr({ url }: JoinQrProps) {
  const [status, setStatus] = useState<CopyStatus>('idle');
  // The clipboard API exists only in a secure context: on localhost, but not on a plain-HTTP LAN address.
  const canCopy = navigator.clipboard !== undefined;

  function copy() {
    navigator.clipboard.writeText(url).then(
      () => setStatus('copied'),
      () => setStatus('failed'),
    );
    setTimeout(() => setStatus('idle'), STATUS_MS);
  }

  return (
    <div className={styles.joinQr}>
      <div className={styles.pad}>
        {/* The pad around the code is its quiet zone, so the code itself is drawn without a margin. */}
        <QRCodeSVG className={styles.code} value={url} level="M" marginSize={0} />
      </div>
      {/* The scheme is dropped: it only makes the address longer to type. */}
      <p className={styles.url}>{url.replace(/^\w+:\/\//, '')}</p>
      {canCopy && (
        <Button variant="ghost" className={styles.copy} onClick={copy}>
          {COPY_LABELS[status]}
        </Button>
      )}
    </div>
  );
}
