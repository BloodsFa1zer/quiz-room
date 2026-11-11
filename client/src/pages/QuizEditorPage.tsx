import { useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Logo } from '../components/ui/Logo';
import { Screen } from '../components/ui/Screen';

/** Stub of the quiz editor; the real one arrives in stage B4. */
export function QuizEditorPage() {
  // No quizId in the address means the page was opened as /quizzes/new.
  const { quizId } = useParams();

  return (
    <Screen variant="page">
      <Logo />
      <Card>
        <h1>Редактор квізу</h1>
        <p>Сторінка QuizEditorPage — заглушка.</p>
        <p>Квіз (quizId): {quizId ?? 'новий квіз'}</p>
      </Card>
    </Screen>
  );
}
