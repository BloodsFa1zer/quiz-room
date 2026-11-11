import { isValidPlayerName, MAX_PLAYERS, type Ack, type Quiz } from '@quiz/shared';
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

function findByName(room: Room, name: string): Player | undefined {
  const wanted = name.toLowerCase();
  for (const player of room.players.values()) {
    if (player.name.toLowerCase() === wanted) return player;
  }
  return undefined;
}
