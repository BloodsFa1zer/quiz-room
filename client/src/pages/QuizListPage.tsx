import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ERROR_MESSAGES, type QuizSummary } from '@quiz/shared';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Logo } from '../components/ui/Logo';
import { Notice } from '../components/ui/Notice';
import { Screen } from '../components/ui/Screen';
import { Spinner } from '../components/ui/Spinner';
import { ApiRequestError, deleteQuiz, listQuizzes } from '../lib/api';
import { plural } from '../lib/format';
import { socket } from '../lib/socket';
import styles from './QuizListPage.module.css';

// How long the host waits for the server to create a room.
const CREATE_TIMEOUT_MS = 5000;

function errorText(error: unknown): string {
  return error instanceof ApiRequestError ? error.message : 'Щось пішло не так';
}

export function QuizListPage() {
  const navigate = useNavigate();
  // null while the list is loading or failed to load.
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setQuizzes(null);
    setLoadError(null);
    try {
      setQuizzes(await listQuizzes());
    } catch (error) {
      setLoadError(errorText(error));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(quiz: QuizSummary) {
    if (!window.confirm(`Видалити квіз «${quiz.title}»?`)) return;
    setDeletingId(quiz.id);
    setDeleteError(null);
    try {
      await deleteQuiz(quiz.id);
      // The card disappears right away; there is no need to load the whole list again.
      setQuizzes((list) => list && list.filter((q) => q.id !== quiz.id));
    } catch (error) {
      setDeleteError(`Не вдалося видалити квіз «${quiz.title}»: ${errorText(error)}`);
    } finally {
      setDeletingId(null);
    }
  }

  function launch(quiz: QuizSummary) {
    setLaunchingId(quiz.id);
    setLaunchError(null);
    // This socket becomes the host of the new room; the game page then joins it once more by PIN.
    socket.timeout(CREATE_TIMEOUT_MS).emit('host:create', { quizId: quiz.id }, (err, res) => {
      setLaunchingId(null);
      if (err) return setLaunchError(`Не вдалося запустити квіз «${quiz.title}»: Сервер не відповідає`);
      if (!res.ok) return setLaunchError(`Не вдалося запустити квіз «${quiz.title}»: ${ERROR_MESSAGES[res.error]}`);
      navigate(`/host/${res.pin}`);
    });
  }

  const createButton = <Button onClick={() => navigate('/quizzes/new')}>Створити квіз</Button>;

  return (
    <Screen variant="page">
      <header className={styles.header}>
        <Logo />
        <div className={styles.headerActions}>
          <Link to="/">Вхід для гравців</Link>
          {createButton}
        </div>
      </header>

      <h1 className={styles.title}>Квізи</h1>

      {launchError && <Notice tone="error">{launchError}</Notice>}
      {deleteError && <Notice tone="error">{deleteError}</Notice>}

      {loadError !== null ? (
        <div className={styles.state}>
          <Notice tone="error">Не вдалося завантажити квізи: {loadError}</Notice>
          <Button variant="secondary" onClick={() => void load()}>
            Спробувати ще
          </Button>
        </div>
      ) : quizzes === null ? (
        <p className={styles.loading}>
          <Spinner /> Завантажуємо квізи…
        </p>
      ) : quizzes.length === 0 ? (
        <div className={styles.state}>
          <p>Квізів ще немає.</p>
          {createButton}
        </div>
      ) : (
        <ul className={styles.list}>
          {quizzes.map((quiz) => (
            <li key={quiz.id}>
              <Card>
                <div className={styles.quiz}>
                  <div className={styles.info}>
                    <h2 className={styles.quizTitle}>{quiz.title}</h2>
                    <p className={styles.meta}>
                      {quiz.questionCount} {plural(quiz.questionCount, ['питання', 'питання', 'питань'])} · оновлено{' '}
                      {new Date(quiz.updatedAt).toLocaleDateString('uk-UA')}
                    </p>
                  </div>
                  <div className={styles.actions}>
                    <Button loading={launchingId === quiz.id} onClick={() => launch(quiz)}>
                      Запустити
                    </Button>
                    <Button variant="secondary" onClick={() => navigate(`/quizzes/${quiz.id}`)}>
                      Редагувати
                    </Button>
                    <Button variant="ghost" loading={deletingId === quiz.id} onClick={() => void remove(quiz)}>
                      Видалити
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
