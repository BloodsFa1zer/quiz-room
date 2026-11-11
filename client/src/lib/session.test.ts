import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, loadSession, saveSession } from './session';

/** In-memory stand-in for the browser storage (tests run in Node). */
function createFakeStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
  };
}

const session = { pin: '123456', name: 'Оля', playerId: 'abc123' };

describe('session', () => {
  let storage: ReturnType<typeof createFakeStorage>;

  beforeEach(() => {
    storage = createFakeStorage();
    vi.stubGlobal('sessionStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when nothing was saved', () => {
    expect(loadSession()).toBeNull();
  });

  it('loads exactly what was saved', () => {
    saveSession(session);
    expect(loadSession()).toEqual(session);
  });

  it('stores the session under the quizroom.player key', () => {
    saveSession(session);
    expect(storage.getItem('quizroom.player')).toBe(JSON.stringify(session));
  });

  it('returns null for corrupted JSON', () => {
    storage.setItem('quizroom.player', '{"pin":"1234');
    expect(loadSession()).toBeNull();
  });

  it('returns null for valid JSON of the wrong shape', () => {
    storage.setItem('quizroom.player', JSON.stringify({ pin: 123456 }));
    expect(loadSession()).toBeNull();
  });

  it('returns null after clearSession', () => {
    saveSession(session);
    clearSession();
    expect(loadSession()).toBeNull();
  });

  it('does not throw when the storage is unavailable', () => {
    const broken = () => {
      throw new Error('storage is blocked');
    };
    vi.stubGlobal('sessionStorage', { getItem: broken, setItem: broken, removeItem: broken });

    expect(() => saveSession(session)).not.toThrow();
    expect(() => clearSession()).not.toThrow();
    expect(loadSession()).toBeNull();
  });
});
