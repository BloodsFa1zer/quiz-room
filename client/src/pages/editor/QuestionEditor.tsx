import {
  MAX_OPTION_LENGTH,
  MAX_OPTIONS,
  MAX_QUESTION_LENGTH,
  MIN_OPTIONS,
  OPTION_LETTERS,
  TIME_LIMIT_CHOICES,
  type Question,
} from '@quiz/shared';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { plural } from '../../lib/format';
import type { DraftQuestion } from '../../lib/quizDraft';
import styles from './QuestionEditor.module.css';

type QuestionEditorProps = {
  question: DraftQuestion;
  /** 1-based position in the quiz. */
  number: number;
  total: number;
  onChange: (patch: Partial<Question>) => void;
  onAddOption: () => void;
  onRemoveOption: (index: number) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
};

/** One question card of the quiz editor. Pure: the page owns the draft and passes the changes back. */
export function QuestionEditor({
  question,
  number,
  total,
  onChange,
  onAddOption,
  onRemoveOption,
  onMove,
  onRemove,
}: QuestionEditorProps) {
  const { key, text, options, correctIndex, timeLimitSec } = question;

  function changeOption(index: number, value: string) {
    onChange({ options: options.map((option, i) => (i === index ? value : option)) });
  }

  return (
    <Card>
      <div className={styles.head}>
        <h2 className={styles.number}>Питання {number}</h2>
        <div className={styles.tools}>
          <Button variant="secondary" aria-label="Перемістити вище" disabled={number === 1} onClick={() => onMove(-1)}>
            ↑
          </Button>
          <Button variant="secondary" aria-label="Перемістити нижче" disabled={number === total} onClick={() => onMove(1)}>
            ↓
          </Button>
          <Button variant="ghost" disabled={total === 1} onClick={onRemove}>
            Видалити питання
          </Button>
        </div>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Текст питання</span>
        <textarea
          className={styles.control}
          rows={2}
          value={text}
          maxLength={MAX_QUESTION_LENGTH}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      </label>

      <fieldset className={styles.options}>
        <legend className={styles.label}>Варіанти відповіді</legend>
        {options.map((option, i) => (
          // Options have no ids of their own; their position is what the quiz stores.
          <div key={i} className={styles.option}>
            <span className={`${styles.letter} ${styles[`opt${i}`]}`}>{OPTION_LETTERS[i]}</span>
            <input
              className={styles.control}
              aria-label={`Варіант ${OPTION_LETTERS[i]}`}
              value={option}
              maxLength={MAX_OPTION_LENGTH}
              onChange={(e) => changeOption(i, e.target.value)}
            />
            <label className={styles.correct}>
              <input
                type="radio"
                name={`correct-${key}`}
                checked={i === correctIndex}
                onChange={() => onChange({ correctIndex: i })}
              />
              правильна
            </label>
            {options.length > MIN_OPTIONS && (
              <Button variant="ghost" aria-label={`Видалити варіант ${OPTION_LETTERS[i]}`} onClick={() => onRemoveOption(i)}>
                ✕
              </Button>
            )}
          </div>
        ))}
        {options.length < MAX_OPTIONS && (
          <div>
            <Button variant="ghost" onClick={onAddOption}>
              + Додати варіант
            </Button>
          </div>
        )}
      </fieldset>

      <label className={styles.field}>
        <span className={styles.label}>Час на відповідь</span>
        <select
          className={`${styles.control} ${styles.select}`}
          value={timeLimitSec}
          onChange={(e) => onChange({ timeLimitSec: Number(e.target.value) })}
        >
          {TIME_LIMIT_CHOICES.map((sec) => (
            <option key={sec} value={sec}>
              {sec} {plural(sec, ['секунда', 'секунди', 'секунд'])}
            </option>
          ))}
        </select>
      </label>
    </Card>
  );
}
