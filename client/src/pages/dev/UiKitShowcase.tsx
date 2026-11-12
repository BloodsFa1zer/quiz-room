import type { ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Logo } from '../../components/ui/Logo';
import { Notice } from '../../components/ui/Notice';
import { Screen } from '../../components/ui/Screen';
import { Spinner } from '../../components/ui/Spinner';
import { TextInput } from '../../components/ui/TextInput';
import styles from './UiKitShowcase.module.css';

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger'] as const;
const SIZES = ['m', 'l'] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

/** Every component of the UI kit in every variant: the `ui/kit` entry of the /dev gallery. */
export function UiKitShowcase() {
  return (
    <Screen variant="page">
      <div className={styles.gallery}>
        <h1>Галерея UI-кіта</h1>

        <Section title="Logo">
          <Logo />
        </Section>

        <Section title="Button">
          {SIZES.map((size) => (
            <div className={styles.row} key={size}>
              {VARIANTS.map((variant) => (
                <Button key={variant} variant={variant} size={size}>
                  {variant} · {size}
                </Button>
              ))}
            </div>
          ))}
          <div className={styles.row}>
            {VARIANTS.map((variant) => (
              <Button key={variant} variant={variant} loading>
                loading
              </Button>
            ))}
          </div>
          <div className={styles.row}>
            {VARIANTS.map((variant) => (
              <Button key={variant} variant={variant} disabled>
                disabled
              </Button>
            ))}
          </div>
          <Button size="l" fullWidth>
            fullWidth · l
          </Button>
        </Section>

        <Section title="TextInput">
          <TextInput label="Твоє імʼя" placeholder="Наприклад, Оля" />
          <TextInput label="Код гри" defaultValue="12345" error="Код гри має містити 6 цифр" />
        </Section>

        <Section title="Notice">
          <Notice tone="info">Гра почнеться, щойно ведучий натисне «Почати».</Notice>
          <Notice tone="error">Гру з таким кодом не знайдено</Notice>
          <Notice tone="success">Квіз збережено</Notice>
        </Section>

        <Section title="Card">
          <Card>
            <h3>Столиці світу</h3>
            <p>5 питань</p>
          </Card>
        </Section>

        <Section title="Spinner">
          <div className={styles.row}>
            <Spinner />
            <span className={styles.bigSpinner}>
              <Spinner />
            </span>
          </div>
        </Section>
      </div>
    </Screen>
  );
}
