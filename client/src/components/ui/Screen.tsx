import type { ReactNode } from 'react';
import styles from './Screen.module.css';

type ScreenProps = {
  /** phone — player screens; stage — host screens on the projector; page — quiz pages on a laptop. */
  variant: 'phone' | 'stage' | 'page';
  /**
   * phone only: exactly one screen high instead of "at least one screen". Then a child with
   * `flex: 1` gets a definite height that its own children can fill (the answer buttons).
   */
  fit?: boolean;
  children: ReactNode;
};

/** Layout wrapper of every page: applies the rules of one of the three screen formats. */
export function Screen({ variant, fit = false, children }: ScreenProps) {
  const className = [styles.screen, styles[variant], fit ? styles.fit : ''].filter(Boolean).join(' ');
  return <main className={className}>{children}</main>;
}
