/**
 * Picks the Ukrainian plural form for a number:
 * plural(1, ['гравець', 'гравці', 'гравців']) → 'гравець', 3 → 'гравці', 5 → 'гравців'.
 */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const lastTwo = Math.abs(n) % 100;
  const last = lastTwo % 10;
  // 11–14 are an exception: they end in 1–4 but take the "many" form.
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

const NBSP = ' ';

/** Formats a score with thousands separated by a non-breaking space: 1250 → '1 250'. */
export function formatScore(n: number): string {
  // A non-breaking space keeps the number on one line; the regex finds every position
  // that is followed by a whole number of three-digit groups.
  return String(Math.round(n)).replace(/\B(?=(\d{3})+$)/g, NBSP);
}

/** A score with its unit, for the player screens: 1 → '1 бал', 1730 → '1 730 балів'. */
export function formatPoints(n: number): string {
  return `${formatScore(n)} ${plural(n, ['бал', 'бали', 'балів'])}`;
}

/** The game code as it is read aloud, split in the middle: '123456' → '123 456'. */
export function formatPin(pin: string): string {
  const middle = Math.ceil(pin.length / 2);
  return `${pin.slice(0, middle)} ${pin.slice(middle)}`;
}
