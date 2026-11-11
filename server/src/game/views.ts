import {
  LEADERBOARD_SIZE,
  type HostState,
  type LeaderboardEntry,
  type PlayerState,
  type Question,
  type QuestionPublic,
} from '@quiz/shared';
import type { Room } from './types';

// Room → snapshots. Implements the phase/field table from docs/00-common.md §6.3.
// Pure: the snapshot time comes in as `now`.

/** Score descending, ties broken by join order; rank = position + 1. */
export function buildLeaderboard(room: Room): LeaderboardEntry[] {
  return [...room.players.values()]
    .sort((a, b) => b.score - a.score || a.joinOrder - b.joinOrder)
    .map((p, i) => ({ playerId: p.id, name: p.name, score: p.score, rank: i + 1, lastPoints: p.lastPoints }));
}

export function buildHostState(room: Room, now: number): HostState {
  const current = currentQuestion(room);
  return {
    ...buildBase(room, now),
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      connected: p.socketId !== null,
    })),
    answeredCount: hasQuestion(room) ? room.answers.size : 0,
    answerCounts: isRevealed(room) && current ? countAnswers(room, current) : null,
    // Scores change only at reveal, so during `question` this still shows the scores before it.
    leaderboard: buildLeaderboard(room),
  };
}

export function buildPlayerState(room: Room, playerId: string, now: number): PlayerState {
  const player = room.players.get(playerId);
  if (!player) throw new Error(`Player ${playerId} is not in room ${room.pin}`);
  const leaderboard = buildLeaderboard(room);
  const rank = leaderboard.findIndex((entry) => entry.playerId === playerId) + 1;
  const answer = room.answers.get(playerId);
  return {
    ...buildBase(room, now),
    me: { id: player.id, name: player.name, score: player.score, rank },
    playerCount: room.players.size,
    myAnswer: hasQuestion(room) ? (answer?.optionIndex ?? null) : null,
    lastResult: isRevealed(room) ? { correct: answer?.correct ?? false, points: answer?.points ?? 0 } : null,
    top: leaderboard.slice(0, LEADERBOARD_SIZE),
  };
}

/** Fields shared by host and player snapshots. */
function buildBase(room: Room, now: number) {
  const current = currentQuestion(room);
  return {
    pin: room.pin,
    phase: room.phase,
    quizTitle: room.quiz.title,
    questionIndex: room.questionIndex,
    questionCount: room.quiz.questions.length,
    question: hasQuestion(room) && current ? toPublic(current) : null,
    endsAt: room.phase === 'question' ? room.endsAt : null,
    // Never during `question`: the answer must not leak before reveal.
    correctIndex: isRevealed(room) && current ? current.correctIndex : null,
    serverNow: now,
  };
}

function currentQuestion(room: Room): Question | undefined {
  return room.quiz.questions[room.questionIndex];
}

/** Phases in which a current question exists. */
function hasQuestion(room: Room): boolean {
  return room.phase === 'question' || isRevealed(room);
}

/** Phases in which the correct answer is shown. */
function isRevealed(room: Room): boolean {
  return room.phase === 'reveal' || room.phase === 'leaderboard';
}

function toPublic(question: Question): QuestionPublic {
  return { text: question.text, options: [...question.options], timeLimitSec: question.timeLimitSec };
}

function countAnswers(room: Room, question: Question): number[] {
  const counts = question.options.map(() => 0);
  for (const answer of room.answers.values()) counts[answer.optionIndex] += 1;
  return counts;
}
