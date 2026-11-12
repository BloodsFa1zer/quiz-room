import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MAX_TITLE_LENGTH, validateQuizInput } from '@quiz/shared';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';
import { Notice } from '../components/ui/Notice';
import { Screen } from '../components/ui/Screen';
import { Spinner } from '../components/ui/Spinner';
import { TextInput } from '../components/ui/TextInput';
import { ApiRequestError, createQuiz, getQuiz, updateQuiz } from '../lib/api';
import * as drafts from '../lib/quizDraft';
import { QuestionEditor } from './editor/QuestionEditor';
import styles from './QuizEditorPage.module.css';

type SaveError = { title: string; details: string[] };

/** The draft as the server would store it; two equal strings mean "no unsaved changes". */
function snapshot(draft: drafts.QuizDraft): string {
  return JSON.stringify(drafts.toQuizInput(draft));
}

export function QuizEditorPage() {
  // No quizId in the address means the page was opened as /quizzes/new.
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<drafts.QuizDraft | null>(() => (quizId ? null : drafts.emptyDraft()));
  const [saved, setSaved] = useState(() => (draft ? snapshot(draft) : ''));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const [saving, setSaving] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!quizId) return;
    // Ignores the answer if the user has already left for another quiz.
    let current = true;
    getQuiz(quizId).then(
      (quiz) => {
        if (!current) return;
        const loaded = drafts.draftFromQuiz(quiz);
        setDraft(loaded);
        setSaved(snapshot(loaded));
      },
      (error: unknown) => {
        if (!current) return;
        const notFound = error instanceof ApiRequestError && error.status === 404;
        setLoadError(notFound ? 'Квіз не знайдено' : `Не вдалося завантажити квіз: ${errorText(error)}`);
      },
    );
    return () => {
      current = false;
    };
  }, [quizId]);

  function change(update: (d: drafts.QuizDraft) => drafts.QuizDraft) {
    setDraft((d) => (d ? update(d) : d));
  }

  function addQuestion() {
    // flushSync renders the new card right away, so the next line can scroll to it.
    flushSync(() => change(drafts.addQuestion));
    listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function showSaveError(error: SaveError) {
    setSaveError(error);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save() {
    if (!draft) return;
    const input = drafts.toQuizInput(draft);
    // The same check the server runs: an invalid quiz is not even sent.
    const details = validateQuizInput(input);
    if (details.length > 0) {
      showSaveError({ title: 'Квіз не збережено. Виправте помилки:', details });
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      if (quizId) await updateQuiz(quizId, input);
      else await createQuiz(input);
      navigate('/quizzes');
    } catch (error) {
      // The draft stays on the page, so nothing typed is lost and the user can try again.
      const details = error instanceof ApiRequestError ? error.details : [];
      showSaveError({ title: `Не вдалося зберегти квіз: ${errorText(error)}`, details });
      setSaving(false);
    }
  }

  function cancel() {
    const changed = draft !== null && snapshot(draft) !== saved;
    if (changed && !window.confirm('Вийти без збереження?')) return;
    navigate('/quizzes');
  }

  return (
    <Screen variant="page">
      <Logo />
      <h1 className={styles.title}>{quizId ? 'Редагування квізу' : 'Новий квіз'}</h1>

      {loadError !== null ? (
        <div className={styles.state}>
          <Notice tone="error">{loadError}</Notice>
          <Link to="/quizzes">До списку квізів</Link>
        </div>
      ) : draft === null ? (
        <p className={styles.loading}>
          <Spinner /> Завантажуємо квіз…
        </p>
      ) : (
        <div className={styles.editor}>
          {saveError && (
            <Notice tone="error">
              <p>{saveError.title}</p>
              {saveError.details.length > 0 && (
                <ul className={styles.errors}>
                  {saveError.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              )}
            </Notice>
          )}

          <TextInput
            label="Назва квізу"
            value={draft.title}
            maxLength={MAX_TITLE_LENGTH}
            onChange={(e) => change((d) => ({ ...d, title: e.target.value }))}
          />

          <ol ref={listRef} className={styles.questions}>
            {draft.questions.map((question, i) => (
              <li key={question.key}>
                <QuestionEditor
                  question={question}
                  number={i + 1}
                  total={draft.questions.length}
                  onChange={(patch) => change((d) => drafts.updateQuestion(d, question.key, patch))}
                  onAddOption={() => change((d) => drafts.addOption(d, question.key))}
                  onRemoveOption={(index) => change((d) => drafts.removeOption(d, question.key, index))}
                  onMove={(direction) => change((d) => drafts.moveQuestion(d, question.key, direction))}
                  onRemove={() => change((d) => drafts.removeQuestion(d, question.key))}
                />
              </li>
            ))}
          </ol>

          <div>
            <Button variant="secondary" onClick={addQuestion}>
              + Додати питання
            </Button>
          </div>

          <div className={styles.bar}>
            <div className={styles.barInner}>
              <Button variant="ghost" onClick={cancel}>
                Скасувати
              </Button>
              <Button loading={saving} onClick={() => void save()}>
                Зберегти
              </Button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}

function errorText(error: unknown): string {
  return error instanceof ApiRequestError ? error.message : 'Щось пішло не так';
}
