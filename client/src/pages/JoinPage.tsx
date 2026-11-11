import { useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Logo } from '../components/ui/Logo';
import { Screen } from '../components/ui/Screen';

/** Stub of the player entry page; the real form arrives in stage B5. */
export function JoinPage() {
  const [searchParams] = useSearchParams();
  const pin = searchParams.get('pin');

  return (
    <Screen variant="phone">
      <Logo />
      <Card>
        <h1>Вхід гравця</h1>
        <p>Сторінка JoinPage — заглушка.</p>
        <p>Код гри з адреси (pin): {pin ?? 'не вказано'}</p>
      </Card>
    </Screen>
  );
}
