import { isValidPlayerName, MAX_PLAYERS, type Ack, type Quiz } from '@quiz/shared';
import { calcPoints } from './scoring';
import type { Player, Room } from './types';

// Game rules as pure functions over a Room. No sockets, no timers, no reading the clock:
// the current time always comes in as `now`, so every rule can be unit-tested.

export function createRoomState(pin: string, quiz: Quiz, now: number): Room {
  return {
    pin,
    // A copy, so editing the quiz does not affect a game that is already running.
    quiz: structuredClone(quiz),
    phase: 'lobby',
    questionIndex: -1,
    players: new Map(),
    answers: new Map(),
    questionStartedAt: null,
    endsAt: null,
    timer: null,
    createdAt: now,
  };
}

/** Applies the join rules from docs/00-common.md §6.5.3 in that exact order. */
export function joinPlayer(
  room: Room,
  input: { playerId: string; name: string; socketId: string },
): Ack<{ playerId: string }> {
  if (!isValidPlayerName(input.name)) return { ok: false, error: 'INVALID_NAME' };
  const name = input.name.trim();

  // Reconnect: same browser tab came back (page reload, phone woke up).
  const existing = room.players.get(input.playerId);
  if (existing) {
    existing.socketId = input.socketId;
    return { ok: true, playerId: existing.id };
  }

  // Same name: taken if that player is online; otherwise this socket takes the player over.
  const namesake = findByName(room, name);
  if (namesake) {
    if (namesake.socketId !== null) return { ok: false, error: 'NAME_TAKEN' };
    namesake.socketId = input.socketId;
    return { ok: true, playerId: namesake.id };
  }

  if (room.phase === 'finished') return { ok: false, error: 'GAME_FINISHED' };
  if (room.players.size >= MAX_PLAYERS) return { ok: false, error: 'ROOM_FULL' };

  const player: Player = {
    id: input.playerId,
    name,
    score: 0,
    lastPoints: 0,
    socketId: input.socketId,
    joinOrder: room.players.size,
  };
  room.players.set(player.id, player);
  return { ok: true, playerId: player.id };
}

/** Marks the player owning this socket as disconnected. Returns that player, or null if none matched. */
export function disconnectPlayer(room: Room, socketId: string): Player | null {
  // Matching by socketId means an old socket that drops after a reconnect does not disconnect the player.
  for (const player of room.players.values()) {
    if (player.socketId === socketId) {
      player.socketId = null;
      return player;
    }
  }
  return null;
}

/** host:next — transition table from docs/00-common.md §6.4. */
export function advance(room: Room, now: number): Ack {
  switch (room.phase) {
    case 'lobby':
      if (room.players.size === 0) return { ok: false, error: 'NO_PLAYERS' };
      startQuestion(room, 0, now);
      return { ok: true };
    case 'question':
      reveal(room);
      return { ok: true };
    case 'reveal':
      // After the last question the game ends without one more leaderboard.
      room.phase = room.questionIndex === room.quiz.questions.length - 1 ? 'finished' : 'leaderboard';
      return { ok: true };
    case 'leaderboard':
      startQuestion(room, room.questionIndex + 1, now);
      return { ok: true };
    case 'finished':
      return { ok: false, error: 'GAME_FINISHED' };
  }
}

export function submitAnswer(room: Room, playerId: string, optionIndex: number, now: number): Ack {
  if (room.phase !== 'question') return { ok: false, error: 'NOT_ACCEPTING_ANSWERS' };
  if (!room.players.has(playerId)) return { ok: false, error: 'NOT_IN_ROOM' };
  if (room.answers.has(playerId)) return { ok: false, error: 'ALREADY_ANSWERED' };
  const question = room.quiz.questions[room.questionIndex];
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) {
    return { ok: false, error: 'INVALID_OPTION' };
  }
  const correct = optionIndex === question.correctIndex;
  const elapsedMs = now - (room.questionStartedAt ?? now);
  // Points are only remembered here; the score changes at reveal, so nothing leaks during the question.
  const points = correct ? calcPoints(elapsedMs, question.timeLimitSec * 1000) : 0;
  room.answers.set(playerId, { optionIndex, correct, points });
  return { ok: true };
}

/** true when phase is `question`, at least one player is connected and every connected player has answered. */
export function shouldAutoReveal(room: Room): boolean {
  if (room.phase !== 'question') return false;
  const connected = [...room.players.values()].filter((p) => p.socketId !== null);
  return connected.length > 0 && connected.every((p) => room.answers.has(p.id));
}

/** question → reveal: adds points to scores, sets lastPoints for EVERY player (0 if no answer). */
export function reveal(room: Room): void {
  room.phase = 'reveal';
  room.endsAt = null;
  for (const player of room.players.values()) {
    player.lastPoints = room.answers.get(player.id)?.points ?? 0;
    player.score += player.lastPoints;
  }
}

function startQuestion(room: Room, index: number, now: number): void {
  room.phase = 'question';
  room.questionIndex = index;
  room.answers.clear();
  room.questionStartedAt = now;
  room.endsAt = now + room.quiz.questions[index].timeLimitSec * 1000;
}

function findByName(room: Room, name: string): Player | undefined {
  const wanted = name.toLowerCase();
  for (const player of room.players.values()) {
    if (player.name.toLowerCase() === wanted) return player;
  }
  return undefined;
}
