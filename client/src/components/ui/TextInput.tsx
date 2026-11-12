import { useId, type ComponentProps } from 'react';
import styles from './TextInput.module.css';

type TextInputProps = ComponentProps<'input'> & {
  label: string;
  /** Error text under the field; the field is highlighted while it is set. */
  error?: string;
};

export function TextInput({ label, error, id, className = '', ...rest }: TextInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const classes = [styles.input, error ? styles.invalid : '', className].filter(Boolean).join(' ');

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input
        {...rest}
        id={inputId}
        className={classes}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
