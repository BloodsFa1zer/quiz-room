import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, Phase, Quiz, ServerToClientEvents } from '@quiz/shared';

export interface Player {
  id: string;
  name: string;
  score: number;
  /** Points for the most recently revealed question. */
  lastPoints: number;
  /** null while disconnected. */
  socketId: string | null;
  /** 0-based order of joining; tie-breaker for the leaderboard. */
  joinOrder: number;
}

export interface AnswerRecord {
  optionIndex: number;
  correct: boolean;
  /** Computed when the answer arrives, added to the score only at reveal. */
  points: number;
}

export interface Room {
  pin: string;
  /** Deep copy of the quiz taken when the room was created. */
  quiz: Quiz;
  phase: Phase;
  /** -1 in lobby. */
  questionIndex: number;
  /** Key: playerId. Insertion order = join order. */
  players: Map<string, Player>;
  /** Answers to the CURRENT question. Key: playerId. Cleared when a question starts. */
  answers: Map<string, AnswerRecord>;
  questionStartedAt: number | null;
  endsAt: number | null;
  /** Question timer. Touched ONLY by sockets.ts. */
  timer: ReturnType<typeof setTimeout> | null;
  createdAt: number;
}

export interface SocketData {
  role?: 'host' | 'player';
  pin?: string;
  playerId?: string;
}

export type QuizServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type QuizSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
