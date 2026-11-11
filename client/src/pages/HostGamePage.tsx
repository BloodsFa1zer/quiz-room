import { useParams } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';
import { Screen } from '../components/ui/Screen';

/** Stub of the host game page; the real one arrives in stage B5. */
export function HostGamePage() {
  const { pin } = useParams();

  return (
    <Screen variant="stage">
      <Logo />
      <h1>Гра ведучого</h1>
      <p>Сторінка HostGamePage — заглушка.</p>
      <p>Код гри (pin): {pin}</p>
    </Screen>
  );
}
