import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import express, { type ErrorRequestHandler, type Express } from 'express';
import { Server } from 'socket.io';
import type { ApiError } from '@quiz/shared';
import { CLIENT_DIST, DATA_FILE, ROOM_TTL_MS } from './config';
import { createRoomManager } from './game/roomManager';
import { registerSocketHandlers } from './game/sockets';
import type { QuizServer } from './game/types';
import { createQuizStore } from './quiz/quizStore';
import { createApiRouter } from './quiz/routes';

export interface AppOptions {
  /** Quiz data file; tests and the smoke script pass a temporary one. */
  dataFile?: string;
  /** Room lifetime; the smoke script passes a short one. */
  roomTtlMs?: number;
}

/** Builds the HTTP app without starting to listen, so scripts and tests can run it on any port. */
export function createApp(options: AppOptions = {}) {
  const store = createQuizStore(options.dataFile ?? DATA_FILE);

  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter(store)); // has its own JSON 404, so /api never falls through to the client
  const clientBuilt = serveClient(app);
  app.use(handleError);

  const httpServer = createServer(app);
  const io: QuizServer = new Server(httpServer, { cors: { origin: '*' } });
  const rooms = createRoomManager();
  registerSocketHandlers(io, { store, rooms, roomTtlMs: options.roomTtlMs ?? ROOM_TTL_MS });

  return { app, httpServer, io, store, rooms, clientBuilt };
}

/**
 * Single-port mode: serves client/dist and answers every other GET with index.html,
 * so client routes like /host/123456 work after a page reload. Returns false when there is no build.
 */
function serveClient(app: Express): boolean {
  const indexHtml = join(CLIENT_DIST, 'index.html');
  if (!existsSync(indexHtml)) return false;
  app.use(express.static(CLIENT_DIST));
  // A last app.use instead of app.get('*'): that pattern throws in Express 5 (G4).
  app.use((req, res, next) => {
    if (req.method === 'GET') res.sendFile(indexHtml);
    else next();
  });
  return true;
}

/** Turns any error into a JSON ApiError, so clients never get an HTML page or a stack trace. */
const handleError: ErrorRequestHandler = (err, _req, res, _next) => {
  // express.json() throws a SyntaxError when the request body is not valid JSON.
  if (err instanceof SyntaxError) {
    const body: ApiError = { error: 'Некоректний JSON' };
    res.status(400).json(body);
    return;
  }
  console.error(err);
  const body: ApiError = { error: 'Внутрішня помилка сервера' };
  res.status(500).json(body);
};
