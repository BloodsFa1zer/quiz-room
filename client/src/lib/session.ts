export type PlayerSession = { pin: string; name: string; playerId: string };

const STORAGE_KEY = 'quizroom.player';

function isPlayerSession(value: unknown): value is PlayerSession {
  if (typeof value !== 'object' || value === null) return false;
  const session = value as Partial<PlayerSession>;
  return (
    typeof session.pin === 'string' &&
    typeof session.name === 'string' &&
    typeof session.playerId === 'string'
  );
}

/**
 * The player's identity lives in sessionStorage: it survives a page refresh,
 * but every tab stays a separate player.
 * Storage can be unavailable (private mode) or hold broken data — then there is simply no session.
 */
export function loadSession(): PlayerSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPlayerSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(session: PlayerSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Without storage the game still works; only a page refresh will ask for the name again.
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
