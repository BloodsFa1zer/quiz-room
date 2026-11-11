import { useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Logo } from '../components/ui/Logo';
import { Screen } from '../components/ui/Screen';

/** Stub of the player game page; the real one arrives in stage B5. */
export function PlayerGamePage() {
  const { pin } = useParams();

  return (
    <Screen variant="phone">
      <Logo />
      <Card>
        <h1>Гра гравця</h1>
        <p>Сторінка PlayerGamePage — заглушка.</p>
        <p>Код гри (pin): {pin}</p>
      </Card>
    </Screen>
  );
}
