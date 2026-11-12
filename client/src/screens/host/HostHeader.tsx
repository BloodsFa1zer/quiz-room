import type { ReactNode } from 'react';
import styles from './HostHeader.module.css';

type HostHeaderProps = {
  title: string;
  /** The main button of the screen. It is always in the same corner, so the host finds it at once. */
  children: ReactNode;
};

/** Top row of every host screen: a title on the left, the action button on the right. */
export function HostHeader({ title, children }: HostHeaderProps) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.action}>{children}</div>
    </header>
  );
}
