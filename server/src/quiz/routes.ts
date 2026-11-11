import { Router, type Response } from 'express';
import { validateQuizInput, type ApiError, type ServerConfig } from '@quiz/shared';
import { getLanIp } from '../config';
import type { QuizStore } from './quizStore';

/** REST API from docs/00-common.md §6.1, mounted at /api. */
export function createApiRouter(store: QuizStore): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  router.get('/config', (_req, res) => {
    const config: ServerConfig = { lanIp: getLanIp() };
    res.json(config);
  });

  router.get('/quizzes', (_req, res) => {
    res.json(store.list());
  });

  router.get('/quizzes/:id', (req, res) => {
    const quiz = store.get(req.params.id);
    if (!quiz) return sendError(res, 404, { error: 'Квіз не знайдено' });
    res.json(quiz);
  });

  router.post('/quizzes', (req, res) => {
    const details = validateQuizInput(req.body);
    if (details.length > 0) return sendError(res, 400, { error: 'Некоректні дані квізу', details });
    res.status(201).json(store.create(req.body));
  });

  router.put('/quizzes/:id', (req, res) => {
    const details = validateQuizInput(req.body);
    if (details.length > 0) return sendError(res, 400, { error: 'Некоректні дані квізу', details });
    const quiz = store.update(req.params.id, req.body);
    if (!quiz) return sendError(res, 404, { error: 'Квіз не знайдено' });
    res.json(quiz);
  });

  router.delete('/quizzes/:id', (req, res) => {
    if (!store.remove(req.params.id)) return sendError(res, 404, { error: 'Квіз не знайдено' });
    res.status(204).end();
  });

  // Any other /api/* path: JSON 404 instead of Express's HTML page.
  router.use((_req, res) => {
    sendError(res, 404, { error: 'Не знайдено' });
  });

  return router;
}

function sendError(res: Response, status: number, body: ApiError): void {
  res.status(status).json(body);
}
