import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';
import { Screen } from '../components/ui/Screen';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import styles from './NotFoundPage.module.css';

export function NotFoundPage() {
  useDocumentTitle('Сторінку не знайдено');
  const navigate = useNavigate();

  return (
    <Screen variant="phone">
      <Logo />
      <div className={styles.body}>
        <h1>Сторінку не знайдено</h1>
        <p className={styles.hint}>Перевір адресу або повернись на головну.</p>
        <Button size="l" fullWidth onClick={() => navigate('/')}>
          На головну
        </Button>
      </div>
    </Screen>
  );
}
