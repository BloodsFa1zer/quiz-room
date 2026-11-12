import type { ReactNode } from 'react';
import styles from './Card.module.css';

type CardProps = { children: ReactNode };

/** A raised surface that stacks its children vertically. */
export function Card({ children }: CardProps) {
  return <div className={styles.card}>{children}</div>;
}
