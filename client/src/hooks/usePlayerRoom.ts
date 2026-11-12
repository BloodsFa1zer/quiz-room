import { useEffect, useState } from 'react';
import type { ErrorCode, PlayerState } from '@quiz/shared';
import { clearSession, loadSession } from '../lib/session';
import { socket } from '../lib/socket';

type Snapshot = { state: PlayerState; clockOffset: number };
/** An answer that is tapped but not yet in a snapshot; it belongs to one question only. */
type Pending = { questionIndex: number; optionIndex: number };

/**
 * Player side of a room: keeps the latest personal `player:state` snapshot and sends answers.
 * Joining is repeated on every `connect`, so a page refresh, a sleeping phone and a lost connection
 * are handled the same way.
 */
export function usePlayerRoom(pin: string) {
  // Read once: the entry page saves the session right before it opens the game page.
  const [session] = useState(loadSession);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [closed, setClosed] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const status = session !== null && session.pin === pin ? 'ready' : 'needs-join';

  useEffect(() => {
    if (session === null || session.pin !== pin) return;
    const { name, playerId } = session;

    const onState = (state: PlayerState) => {
      if (state.pin !== pin) return;
      setSnapshot({ state, clockOffset: state.serverNow - Date.now() });
    };
    const onClosed = () => setClosed(true);
    const join = () =>
      socket.emit('player:join', { pin, name, playerId }, (res) => {
        if (res.ok) return;
        setError(res.error);
        // The room is gone (e.g. the server restarted): this session will never work again.
        if (res.error === 'ROOM_NOT_FOUND') clearSession();
      });

    socket.on('player:state', onState);
    socket.on('room:closed', onClosed);
    socket.on('connect', join); // also fires on every reconnect
    if (socket.connected) join();

    return () => {
      socket.off('player:state', onState);
      socket.off('room:closed', onClosed);
      socket.off('connect', join);
    };
  }, [pin, session]);

  const state = snapshot?.state ?? null;
  // A pending answer is forgotten as soon as the next question starts.
  const pendingAnswer = pending !== null && pending.questionIndex === state?.questionIndex ? pending.optionIndex : null;

  function answer(optionIndex: number) {
    if (state === null || state.myAnswer !== null || pendingAnswer !== null) return;
    // socket.io would keep the answer until the reconnect and send it before the re-join: the server
    // would refuse it (NOT_IN_ROOM) after the player had already seen "Відповідь прийнято".
    // So while offline a tap does nothing, and the connection banner tells why.
    if (!socket.connected) return;
    const { questionIndex } = state;
    // Optimistic: the buttons are blocked at once, without waiting for the server (the only guess allowed, R6).
    setPending({ questionIndex, optionIndex });
    socket.emit('player:answer', { optionIndex }, (res) => {
      // ALREADY_ANSWERED means the server has an answer, so the buttons stay blocked.
      if (res.ok || res.error === 'ALREADY_ANSWERED') return;
      setPending((current) => (current?.questionIndex === questionIndex ? null : current));
    });
  }

  return {
    status,
    state,
    clockOffset: snapshot?.clockOffset ?? 0,
    error,
    closed,
    pendingAnswer,
    answer,
  };
}
