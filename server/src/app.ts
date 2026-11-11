import { createServer } from 'node:http';
import express, { type ErrorRequestHandler } from 'express';
import type { ApiError } from '@quiz/shared';
import { DATA_FILE } from './config';
import { createQuizStore } from './quiz/quizStore';
import { createApiRouter } from './quiz/routes';

export interface AppOptions {
  /** Quiz data file; tests and the smoke script pass a temporary one. */
  dataFile?: string;
}

/** Builds the HTTP app without starting to listen, so scripts and tests can run it on any port. */
export function createApp(options: AppOptions = {}) {
  const store = createQuizStore(options.dataFile ?? DATA_FILE);

  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter(store));
  app.use(handleError);

  const httpServer = createServer(app);
  return { app, httpServer, store };
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
