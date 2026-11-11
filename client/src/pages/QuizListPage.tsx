import { Card } from '../components/ui/Card';
import { Logo } from '../components/ui/Logo';
import { Screen } from '../components/ui/Screen';

/** Stub of the quiz list; the real one arrives in stage B4. */
export function QuizListPage() {
  return (
    <Screen variant="page">
      <Logo />
      <Card>
        <h1>Список квізів</h1>
        <p>Сторінка QuizListPage — заглушка.</p>
        <p>Параметрів маршруту немає.</p>
      </Card>
    </Screen>
  );
}
