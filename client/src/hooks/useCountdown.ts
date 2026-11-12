import { useEffect, useState } from 'react';
import { getRemainingMs } from '../lib/time';

/**
 * Countdown to the server deadline `endsAt` (docs/00-common.md §6.7).
 * The hook only draws the timer: the question is closed by the server, not by the client.
 * `totalMs` is the full time of the question; `fraction` goes from 1 (just started) to 0 (time is up).
 */
export function useCountdown(endsAt: number | null, clockOffset: number, totalMs: number) {
  const [now, setNow] = useState(() => Date.now());

  // The ticker runs all the time, so `now` is never more than 100 ms old when a new deadline arrives.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const remainingMs = getRemainingMs(endsAt, clockOffset, now);
  const secondsLeft = Math.ceil(remainingMs / 1000);
  const fraction = totalMs > 0 ? Math.min(1, remainingMs / totalMs) : 0;

  return { remainingMs, secondsLeft, fraction };
}
