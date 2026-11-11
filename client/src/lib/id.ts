/**
 * Random id for a player. Deliberately avoids the Web Crypto API: phones open the page
 * by a plain LAN address, which is not a secure context, so that API is missing there.
 */
export function createId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
