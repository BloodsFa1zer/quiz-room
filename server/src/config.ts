import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { SERVER_PORT } from '@quiz/shared';

export const PORT = Number(process.env.PORT) || SERVER_PORT;

/** Resolved from this file's location, so the server finds its data no matter where it was started from. */
export const DATA_FILE =
  process.env.DATA_FILE || fileURLToPath(new URL('../data/quizzes.json', import.meta.url));

/** A room is closed this long after it was created (2 hours by default). */
export const ROOM_TTL_MS = Number(process.env.ROOM_TTL_MS) || 2 * 60 * 60 * 1000;

/** The built client (`npm run build`). When it exists, the server also serves it on its own port. */
export const CLIENT_DIST = fileURLToPath(new URL('../../client/dist', import.meta.url));

/** First non-internal IPv4 address of this machine — the address phones use to reach the laptop. */
export function getLanIp(): string | null {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) return address.address;
    }
  }
  return null;
}
