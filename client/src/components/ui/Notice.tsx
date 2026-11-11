import type { ReactNode } from 'react';
import styles from './Notice.module.css';

type NoticeProps = {
  tone?: 'info' | 'error' | 'success';
  children: ReactNode;
};

/** An inline message: a hint, an error from the server or a confirmation. */
export function Notice({ tone = 'info', children }: NoticeProps) {
  return (
    <div className={`${styles.notice} ${styles[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
