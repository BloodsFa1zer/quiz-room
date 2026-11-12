import { QRCodeSVG } from 'qrcode.react';
import styles from './JoinQr.module.css';

type JoinQrProps = {
  /** Full address of the join page, e.g. the result of `buildJoinUrl`. */
  url: string;
};

/** QR code of the join address with the same address in text for those who cannot scan it. */
export function JoinQr({ url }: JoinQrProps) {
  return (
    <div className={styles.joinQr}>
      <div className={styles.pad}>
        {/* The pad around the code is its quiet zone, so the code itself is drawn without a margin. */}
        <QRCodeSVG className={styles.code} value={url} level="M" marginSize={0} />
      </div>
      {/* The scheme is dropped: it only makes the address longer to type. */}
      <p className={styles.url}>{url.replace(/^\w+:\/\//, '')}</p>
    </div>
  );
}
