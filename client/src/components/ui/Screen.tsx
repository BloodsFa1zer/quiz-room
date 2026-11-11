import type { ReactNode } from 'react';
import styles from './Screen.module.css';

type ScreenProps = {
  /** phone — player screens; stage — host screens on the projector; page — quiz pages on a laptop. */
  variant: 'phone' | 'stage' | 'page';
  children: ReactNode;
};

/** Layout wrapper of every page: applies the rules of one of the three screen formats. */
export function Screen({ variant, children }: ScreenProps) {
  return <main className={`${styles.screen} ${styles[variant]}`}>{children}</main>;
}
