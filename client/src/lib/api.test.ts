import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QuizInput } from '@quiz/shared';
import { ApiRequestError, createQuiz, deleteQuiz, listQuizzes } from './api';

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Runs a failing call and returns the error it threw. */
async function catchError(call: () => Promise<unknown>): Promise<ApiRequestError> {
  try {
    await call();
  } catch (error) {
    if (error instanceof ApiRequestError) return error;
    throw error;
  }
  throw new Error('the call was expected to fail');
}

const input: QuizInput = {
  title: 'Столиці',
  questions: [{ text: 'Столиця України?', options: ['Київ', 'Львів'], correctIndex: 0, timeLimitSec: 20 }],
};

describe('api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the parsed body of a 2xx response', async () => {
    const summaries = [{ id: 'q1', title: 'Столиці', questionCount: 1, updatedAt: 1 }];
    const fetchMock = stubFetch(jsonResponse(200, summaries));

    expect(await listQuizzes()).toEqual(summaries);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/quizzes');
  });

  it('sends the payload as JSON', async () => {
    const fetchMock = stubFetch(jsonResponse(201, { id: 'q1', ...input, createdAt: 1, updatedAt: 1 }));

    await createQuiz(input);

    const init = fetchMock.mock.calls[0][1];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify(input));
  });

  it('resolves deleteQuiz on 204 without a body', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));

    await expect(deleteQuiz('q1')).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/quizzes/q1');
    expect(fetchMock.mock.calls[0][1]?.method).toBe('DELETE');
  });

  it('throws ApiRequestError with status, message and details for a non-2xx response', async () => {
    stubFetch(jsonResponse(400, { error: 'Некоректні дані квізу', details: ['Вкажіть назву квізу'] }));

    const error = await catchError(() => createQuiz(input));

    expect(error.status).toBe(400);
    expect(error.message).toBe('Некоректні дані квізу');
    expect(error.details).toEqual(['Вкажіть назву квізу']);
  });

  it('throws ApiRequestError with status 0 when the network fails', async () => {
    stubFetch(new TypeError('Failed to fetch'));

    const error = await catchError(() => listQuizzes());

    expect(error.status).toBe(0);
    expect(error.message).toBe('Сервер недоступний');
    expect(error.details).toEqual([]);
  });

  it('reports an unavailable server when an error response is not JSON', async () => {
    stubFetch(new Response('', { status: 502 }));

    const error = await catchError(() => listQuizzes());

    expect(error.status).toBe(502);
    expect(error.message).toBe('Сервер недоступний');
  });
});
