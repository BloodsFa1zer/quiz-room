/**
 * @quiz/shared — the single contract between server and client.
 *
 * FROZEN after Stage 0. Neither coder edits this file on their own:
 * any change goes through the "contract change" procedure (docs/00-common.md §9).
 * This file must stay a single file with no imports.
 */

// ───────────────────────── Constants ─────────────────────────

export const SERVER_PORT = 3001;
export const CLIENT_PORT = 5173;

export const PIN_LENGTH = 6;
export const MAX_PLAYERS = 50;
export const MAX_NAME_LENGTH = 16;

export const MAX_TITLE_LENGTH = 80;
export const MAX_QUESTION_LENGTH = 200;
export const MAX_OPTION_LENGTH = 80;
export const MAX_QUESTIONS = 50;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;

export const MIN_TIME_LIMIT_SEC = 5;
export const MAX_TIME_LIMIT_SEC = 120;
export const DEFAULT_TIME_LIMIT_SEC = 20;
export const TIME_LIMIT_CHOICES = [5, 10, 20, 30, 60, 90, 120] as const;

/** Points for an instant correct answer. */
export const MAX_POINTS = 1000;
/** Points for a correct answer given at the very last moment. */
export const MIN_POINTS = 500;

/** How many rows the "top" leaderboard shows. */
export const LEADERBOARD_SIZE = 5;

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

// ───────────────────────── Quiz (REST) ─────────────────────────

export interface Question {
  text: string;
  /** MIN_OPTIONS..MAX_OPTIONS non-empty strings. */
  options: string[];
  /** Index into `options`. */
  correctIndex: number;
  /** MIN_TIME_LIMIT_SEC..MAX_TIME_LIMIT_SEC, integer. */
  timeLimitSec: number;
}

export interface Quiz {
  id: string;
  title: string;
  questions: Question[];
  /** Epoch ms. */
  createdAt: number;
  /** Epoch ms. */
  updatedAt: number;
}

export interface QuizSummary {
  id: string;
  title: string;
  questionCount: number;
  updatedAt: number;
}

/** Body of POST /api/quizzes and PUT /api/quizzes/:id. */
export interface QuizInput {
  title: string;
  questions: Question[];
}

/** Body of every non-2xx REST response. */
export interface ApiError {
  error: string;
  details?: string[];
}

/** Response of GET /api/config. */
export interface ServerConfig {
  /** First non-internal IPv4 of the server machine, or null if there is none. */
  lanIp: string | null;
}

/**
 * Validates a quiz payload. Returns a list of human-readable (Ukrainian) errors;
 * an empty list means the payload is valid. Used by BOTH the editor and the server.
 */
export function validateQuizInput(input: unknown): string[] {
  if (typeof input !== 'object' || input === null) return ['Некоректні дані квізу'];
  const { title, questions } = input as Partial<QuizInput>;
  const errors: string[] = [];

  if (typeof title !== 'string' || title.trim() === '') {
    errors.push('Вкажіть назву квізу');
  } else if (title.trim().length > MAX_TITLE_LENGTH) {
    errors.push(`Назва квізу — не довше ${MAX_TITLE_LENGTH} символів`);
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push('Додайте хоча б одне питання');
    return errors;
  }
  if (questions.length > MAX_QUESTIONS) {
    errors.push(`У квізі може бути не більше ${MAX_QUESTIONS} питань`);
  }

  questions.forEach((q: unknown, i: number) => {
    const n = i + 1;
    if (typeof q !== 'object' || q === null) {
      errors.push(`Питання ${n}: некоректні дані`);
      return;
    }
    const { text, options, correctIndex, timeLimitSec } = q as Partial<Question>;

    if (typeof text !== 'string' || text.trim() === '') {
      errors.push(`Питання ${n}: введіть текст питання`);
    } else if (text.trim().length > MAX_QUESTION_LENGTH) {
      errors.push(`Питання ${n}: текст — не довше ${MAX_QUESTION_LENGTH} символів`);
    }

    if (!Array.isArray(options) || options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
      errors.push(`Питання ${n}: має бути від ${MIN_OPTIONS} до ${MAX_OPTIONS} варіантів відповіді`);
    } else {
      if (options.some((o) => typeof o !== 'string' || o.trim() === '')) {
        errors.push(`Питання ${n}: заповніть усі варіанти відповіді`);
      } else if (options.some((o) => o.trim().length > MAX_OPTION_LENGTH)) {
        errors.push(`Питання ${n}: варіант відповіді — не довше ${MAX_OPTION_LENGTH} символів`);
      }
      if (
        typeof correctIndex !== 'number' ||
        !Number.isInteger(correctIndex) ||
        correctIndex < 0 ||
        correctIndex >= options.length
      ) {
        errors.push(`Питання ${n}: позначте правильну відповідь`);
      }
    }

    if (
      typeof timeLimitSec !== 'number' ||
      !Number.isInteger(timeLimitSec) ||
      timeLimitSec < MIN_TIME_LIMIT_SEC ||
      timeLimitSec > MAX_TIME_LIMIT_SEC
    ) {
      errors.push(
        `Питання ${n}: час на відповідь — від ${MIN_TIME_LIMIT_SEC} до ${MAX_TIME_LIMIT_SEC} секунд`,
      );
    }
  });

  return errors;
}

/** A PIN is exactly PIN_LENGTH digits. */
export function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && pin.length === PIN_LENGTH && /^\d+$/.test(pin);
}

/** A player name is 1..MAX_NAME_LENGTH characters after trimming. */
export function isValidPlayerName(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= MAX_NAME_LENGTH;
}

// ───────────────────────── Game state (WebSocket) ─────────────────────────

/**
 * lobby → question → reveal → leaderboard → question → … → reveal → finished
 * (after the LAST question `reveal` goes straight to `finished`, skipping `leaderboard`)
 */
export type Phase = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'finished';

/** A question as clients see it: never contains the correct answer. */
export interface QuestionPublic {
  text: string;
  options: string[];
  timeLimitSec: number;
}

export interface PlayerInfo {
  id: string;
  name: string;
  score: number;
  /** false while the player's socket is disconnected. */
  connected: boolean;
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  score: number;
  /** 1-based position. Sorted by score desc, ties broken by join order. No shared ranks. */
  rank: number;
  /** Points earned for the most recently revealed question (0 before the first reveal). */
  lastPoints: number;
}

/** Fields common to the host and player snapshots. See the phase table in docs/00-common.md §6.3. */
interface RoomStateBase {
  pin: string;
  phase: Phase;
  quizTitle: string;
  /** 0-based index of the current question; -1 in `lobby`; last index in `finished`. */
  questionIndex: number;
  questionCount: number;
  /** Set in `question`, `reveal`, `leaderboard`; null in `lobby` and `finished`. */
  question: QuestionPublic | null;
  /** Server epoch ms when answering closes. Set only in `question`. */
  endsAt: number | null;
  /** Set only in `reveal` and `leaderboard`. NEVER sent during `question`. */
  correctIndex: number | null;
  /** Server epoch ms at the moment this snapshot was built (for clock-offset calculation). */
  serverNow: number;
}

/** Full snapshot for the host screen. Sent as `host:state` after every change. */
export interface HostState extends RoomStateBase {
  /** All players in join order (including disconnected ones). */
  players: PlayerInfo[];
  /** How many players have answered the current question (0 in `lobby` / `finished`). */
  answeredCount: number;
  /** Answers per option for the current question. Set only in `reveal` and `leaderboard`. */
  answerCounts: number[] | null;
  /** All players, sorted. Scores include the current question only from `reveal` on. */
  leaderboard: LeaderboardEntry[];
}

/** Personal snapshot for one player. Sent as `player:state` after every change. */
export interface PlayerState extends RoomStateBase {
  me: { id: string; name: string; score: number; rank: number };
  playerCount: number;
  /** Option this player picked for the current question, or null if not answered. */
  myAnswer: number | null;
  /** Result for the current question. Set only in `reveal` and `leaderboard`. */
  lastResult: { correct: boolean; points: number } | null;
  /** First LEADERBOARD_SIZE entries of the leaderboard. */
  top: LeaderboardEntry[];
}

// ───────────────────────── Socket.IO events ─────────────────────────

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'QUIZ_NOT_FOUND'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'GAME_FINISHED'
  | 'INVALID_NAME'
  | 'NAME_TAKEN'
  | 'NOT_IN_ROOM'
  | 'NO_PLAYERS'
  | 'NOT_ACCEPTING_ANSWERS'
  | 'ALREADY_ANSWERED'
  | 'INVALID_OPTION';

/** Ukrainian UI text for every error code. The client shows these as-is. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  BAD_REQUEST: 'Некоректний запит',
  QUIZ_NOT_FOUND: 'Квіз не знайдено',
  ROOM_NOT_FOUND: 'Гру з таким кодом не знайдено',
  ROOM_FULL: 'У кімнаті вже максимальна кількість гравців',
  GAME_FINISHED: 'Ця гра вже завершилась',
  INVALID_NAME: `Імʼя має містити від 1 до ${MAX_NAME_LENGTH} символів`,
  NAME_TAKEN: 'Це імʼя вже зайняте — обери інше',
  NOT_IN_ROOM: 'Ти не в кімнаті — приєднайся ще раз',
  NO_PLAYERS: 'Потрібен хоча б один гравець',
  NOT_ACCEPTING_ANSWERS: 'Відповіді зараз не приймаються',
  ALREADY_ANSWERED: 'Ти вже відповів на це питання',
  INVALID_OPTION: 'Такого варіанту відповіді немає',
};

/** Every client→server event is answered through its ack callback with this shape. */
export type Ack<T = unknown> = ({ ok: true } & T) | { ok: false; error: ErrorCode };

export interface ClientToServerEvents {
  /** Create a room for a quiz. The calling socket becomes the room's host. */
  'host:create': (payload: { quizId: string }, ack: (res: Ack<{ pin: string }>) => void) => void;
  /** Attach this socket to an existing room as host. Idempotent; used on page load and on reconnect. */
  'host:join': (payload: { pin: string }, ack: (res: Ack) => void) => void;
  /** Advance the game one step (see the transition table in docs/00-common.md §6.4). */
  'host:next': (ack: (res: Ack) => void) => void;
  /** Join a room as a player, or re-attach to an existing player. Idempotent. */
  'player:join': (
    payload: { pin: string; name: string; playerId: string },
    ack: (res: Ack) => void,
  ) => void;
  /** Answer the current question. One answer per question, only during `question`. */
  'player:answer': (payload: { optionIndex: number }, ack: (res: Ack) => void) => void;
}

export interface ServerToClientEvents {
  'host:state': (state: HostState) => void;
  'player:state': (state: PlayerState) => void;
  /** The room was deleted on the server (expired). Clients show a "game is over" screen. */
  'room:closed': () => void;
}
