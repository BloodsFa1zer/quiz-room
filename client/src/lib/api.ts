import type { ApiError, Quiz, QuizInput, QuizSummary, ServerConfig } from '@quiz/shared';

/** Any failed REST call. `status` is the HTTP status, or 0 when the server could not be reached. */
export class ApiRequestError extends Error {
  status: number;
  /** Validation messages from the server (only for 400 responses). */
  details: string[];

  constructor(message: string, status: number, details: string[] = []) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.details = details;
  }
}

const SERVER_UNAVAILABLE = 'Сервер недоступний';

async function readError(res: Response): Promise<ApiError> {
  try {
    return (await res.json()) as ApiError;
  } catch {
    // The server always answers errors with JSON. A non-JSON body comes from the dev proxy
    // when the server process is not running.
    return { error: SERVER_UNAVAILABLE };
  }
}

/** Sends a request to the REST API; resolves only for 2xx responses. */
async function send(path: string, method = 'GET', body?: unknown): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError(SERVER_UNAVAILABLE, 0);
  }
  if (!res.ok) {
    const { error, details } = await readError(res);
    throw new ApiRequestError(error, res.status, details);
  }
  return res;
}

async function sendForJson<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await send(path, method, body);
  return (await res.json()) as T;
}

export function getConfig(): Promise<ServerConfig> {
  return sendForJson<ServerConfig>('/config');
}

export function listQuizzes(): Promise<QuizSummary[]> {
  return sendForJson<QuizSummary[]>('/quizzes');
}

export function getQuiz(id: string): Promise<Quiz> {
  return sendForJson<Quiz>(`/quizzes/${id}`);
}

export function createQuiz(input: QuizInput): Promise<Quiz> {
  return sendForJson<Quiz>('/quizzes', 'POST', input);
}

export function updateQuiz(id: string, input: QuizInput): Promise<Quiz> {
  return sendForJson<Quiz>(`/quizzes/${id}`, 'PUT', input);
}

export async function deleteQuiz(id: string): Promise<void> {
  // 204 has no body, so there is nothing to parse.
  await send(`/quizzes/${id}`, 'DELETE');
}
