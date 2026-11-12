import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ERROR_MESSAGES, MAX_NAME_LENGTH, PIN_LENGTH, isValidPin, isValidPlayerName } from '@quiz/shared';
import { ConnectionBanner } from '../components/game/ConnectionBanner';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';
import { Notice } from '../components/ui/Notice';
import { Screen } from '../components/ui/Screen';
import { TextInput } from '../components/ui/TextInput';
import { useConnection } from '../hooks/useConnection';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { createId } from '../lib/id';
import { loadSession, saveSession } from '../lib/session';
import { socket } from '../lib/socket';
import styles from './JoinPage.module.css';

const JOIN_TIMEOUT_MS = 5000;

/** Leaves only digits and cuts to the PIN length: the field accepts nothing else. */
function onlyDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, PIN_LENGTH);
}

/** `/` — the player enters the game code and a name. The code may come from the QR (`?pin=`). */
export function JoinPage() {
  useDocumentTitle('Вхід');
  const navigate = useNavigate();
  const connected = useConnection();
  const [searchParams] = useSearchParams();
  const [pinFromUrl] = useState(() => onlyDigits(searchParams.get('pin') ?? ''));
  const [pin, setPin] = useState(pinFromUrl);
  const [name, setName] = useState(() => loadSession()?.name ?? '');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canJoin = isValidPin(pin) && isValidPlayerName(name);

  function join(event: FormEvent) {
    event.preventDefault();
    if (!canJoin || joining) return;
    const playerName = name.trim();
    // The same id lets the server recognise this tab as the same player after a refresh.
    const playerId = loadSession()?.playerId ?? createId();
    setJoining(true);
    setError(null);
    socket.timeout(JOIN_TIMEOUT_MS).emit('player:join', { pin, name: playerName, playerId }, (err, res) => {
      setJoining(false);
      if (err) return setError('Сервер не відповідає');
      if (!res.ok) return setError(ERROR_MESSAGES[res.error]);
      saveSession({ pin, name: playerName, playerId });
      navigate(`/play/${pin}`);
    });
  }

  return (
    <Screen variant="phone">
      <ConnectionBanner connected={connected} />

      <div className={styles.logo}>
        <Logo />
      </div>

      <form className={styles.form} onSubmit={join}>
        <TextInput
          label="Код гри"
          value={pin}
          onChange={(event) => setPin(onlyDigits(event.target.value))}
          maxLength={PIN_LENGTH}
          inputMode="numeric"
          autoComplete="off"
          placeholder="123456"
          autoFocus={pinFromUrl === ''}
        />
        <TextInput
          label="Твоє імʼя"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MAX_NAME_LENGTH}
          autoComplete="off"
          // The code came from the QR: the name is the only thing left to type.
          autoFocus={pinFromUrl !== ''}
        />

        {error !== null && <Notice tone="error">{error}</Notice>}

        <Button type="submit" size="l" fullWidth disabled={!canJoin} loading={joining}>
          Приєднатися
        </Button>
      </form>

      <Link className={styles.hostLink} to="/quizzes">
        Я ведучий →
      </Link>
    </Screen>
  );
}
