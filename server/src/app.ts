import { createServer } from 'node:http';
import express from 'express';

/** Builds the HTTP app without starting to listen, so scripts and tests can run it on any port. */
export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  const httpServer = createServer(app);
  return { app, httpServer };
}
