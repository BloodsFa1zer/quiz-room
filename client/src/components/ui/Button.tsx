import type { ComponentProps } from 'react';
import { Spinner } from './Spinner';
import styles from './Button.module.css';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'm' | 'l';
  fullWidth?: boolean;
  /** Shows a spinner and blocks the button while a request is in flight. */
  loading?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'm',
  fullWidth = false,
  loading = false,
  // A native button submits its form by default; a plain click should not do that by accident.
  type = 'button',
  disabled = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], fullWidth ? styles.fullWidth : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button {...rest} type={type} className={classes} disabled={disabled || loading} aria-busy={loading}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}
