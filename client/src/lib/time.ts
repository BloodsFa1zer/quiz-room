/**
 * Milliseconds left until the server deadline `endsAt`.
 * `clockOffset` is `serverNow - Date.now()` taken from the latest snapshot: it moves the local
 * clock onto the server's timeline, so every device counts down to the same moment.
 */
export function getRemainingMs(endsAt: number | null, clockOffset: number, now: number): number {
  if (endsAt === null) return 0;
  return Math.max(0, endsAt - (now + clockOffset));
}
