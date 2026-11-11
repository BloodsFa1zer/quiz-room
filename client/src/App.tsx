import { useEffect, useState } from 'react';
import { DEFAULT_TIME_LIMIT_SEC } from '@quiz/shared';

/** Stage 0 stub: proves that the Vite proxy and the shared package work. Replaced in stage B1. */
export function App() {
  const [health, setHealth] = useState('перевіряю…');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((body: { ok: boolean }) => setHealth(body.ok ? 'сервер на звʼязку ✅' : 'помилка ❌'))
      .catch(() => setHealth('сервер недоступний ❌'));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>QuizRoom</h1>
      <p>API: {health}</p>
      <p>Контракт підключено: час на питання за замовчуванням — {DEFAULT_TIME_LIMIT_SEC} с</p>
    </main>
  );
}
