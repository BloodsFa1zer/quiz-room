import { useCallback, useEffect, useRef, useState } from 'react';
import { ERROR_MESSAGES, type ErrorCode, type HostState } from '@quiz/shared';
import { socket } from '../lib/socket';

// How long the host waits for the server to confirm "Далі" before giving up.
const NEXT_TIMEOUT_MS = 5000;
// The two clicks of a double click are ~100–300 ms apart, but in a local network the server answers
// within a few ms. Without this pause the second click would hit the button of the next screen (G13).
const DOUBLE_CLICK_MS = 500;
const OFFLINE_MESSAGE = 'Немає зʼєднання з сервером — спробуй ще раз за мить';

type Snapshot = { state: HostState; clockOffset: number };

/**
 * Host side of a room: keeps the latest `host:state` snapshot and sends `host:next`.
 * Joining is repeated on every `connect`, so a page refresh and a lost connection are handled the same way.
 */
export function useHostRoom(pin: string) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  // Error of the last "Далі", as text for a Notice: ERROR_MESSAGES or a timeout.
  const [nextError, setNextError] = useState<string | null>(null);
  // Refs, not only state: both clicks of a double click may arrive before React re-renders.
  const busyRef = useRef(false);
  const lastNextAt = useRef(0);

  useEffect(() => {
    const onState = (state: HostState) => {
      if (state.pin !== pin) return;
      setSnapshot({ state, clockOffset: state.serverNow - Date.now() });
    };
    const onClosed = () => setClosed(true);
    const join = () =>
      socket.emit('host:join', { pin }, (res) => {
        if (!res.ok) setError(res.error);
      });

    // Also fires on every reconnect. The error of a "Далі" pressed while offline no longer applies then.
    const onConnect = () => {
      setNextError(null);
      join();
    };

    socket.on('host:state', onState);
    socket.on('room:closed', onClosed);
    socket.on('connect', onConnect);
    if (socket.connected) join();

    return () => {
      socket.off('host:state', onState);
      socket.off('room:closed', onClosed);
      socket.off('connect', onConnect);
    };
  }, [pin]);

  // The same function on every render: the page's keyboard listener subscribes to it once.
  const next = useCallback(() => {
    if (busyRef.current || Date.now() - lastNextAt.current < DOUBLE_CLICK_MS) return;
    // socket.io would keep the command until the reconnect and send it before the re-join,
    // so the server would answer NOT_IN_ROOM ("приєднайся ще раз"), which is wrong for the host.
    if (!socket.connected) {
      setNextError(OFFLINE_MESSAGE);
      return;
    }
    busyRef.current = true;
    lastNextAt.current = Date.now();
    setBusy(true);
    setNextError(null);
    socket.timeout(NEXT_TIMEOUT_MS).emit('host:next', (err, res) => {
      busyRef.current = false;
      setBusy(false);
      if (err) setNextError('Сервер не відповідає');
      else if (!res.ok) setNextError(ERROR_MESSAGES[res.error]);
    });
  }, []);

  return {
    state: snapshot?.state ?? null,
    clockOffset: snapshot?.clockOffset ?? 0,
    error,
    closed,
    busy,
    nextError,
    next,
  };
}
