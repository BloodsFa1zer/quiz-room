import { isValidPin, type Ack } from '@quiz/shared';
import type { QuizStore } from '../quiz/quizStore';
import { disconnectPlayer, joinPlayer } from './engine';
import type { RoomManager } from './roomManager';
import type { QuizServer, QuizSocket, Room } from './types';
import { buildHostState, buildPlayerState } from './views';

/** Every ack in the contract is a plain Ack, except host:create, which also returns the PIN. */
type Reply = (res: Ack | Ack<{ pin: string }>) => void;

// The only place with side effects: sockets and Date.now(). The rules themselves live in engine.ts.
export function registerSocketHandlers(io: QuizServer, deps: { store: QuizStore; rooms: RoomManager }): void {
  const { store, rooms } = deps;

  /** Sends a full snapshot to every host socket of the room and a personal one to every connected player. */
  function broadcast(room: Room): void {
    const now = Date.now();
    io.to('host:' + room.pin).emit('host:state', buildHostState(room, now));
    for (const player of room.players.values()) {
      if (player.socketId) io.to(player.socketId).emit('player:state', buildPlayerState(room, player.id, now));
    }
  }

  /** The single place to call after ANY change to a room. */
  function afterChange(room: Room): void {
    broadcast(room);
  }

  io.on('connection', (socket) => {
    socket.on(
      'host:create',
      safe((payload, ack) => {
        const quizId = field(payload, 'quizId');
        if (typeof quizId !== 'string') return ack({ ok: false, error: 'BAD_REQUEST' });
        const quiz = store.get(quizId);
        if (!quiz) return ack({ ok: false, error: 'QUIZ_NOT_FOUND' });
        const room = rooms.createRoom(quiz);
        attachHost(socket, room.pin);
        ack({ ok: true, pin: room.pin });
        afterChange(room);
      }),
    );

    socket.on(
      'host:join',
      safe((payload, ack) => {
        const pin = field(payload, 'pin');
        if (!isValidPin(pin)) return ack({ ok: false, error: 'BAD_REQUEST' });
        const room = rooms.getRoom(pin);
        if (!room) return ack({ ok: false, error: 'ROOM_NOT_FOUND' });
        attachHost(socket, pin);
        ack({ ok: true });
        afterChange(room);
      }),
    );

    socket.on(
      'player:join',
      safe((payload, ack) => {
        const pin = field(payload, 'pin');
        const name = field(payload, 'name');
        const playerId = field(payload, 'playerId');
        if (typeof pin !== 'string' || typeof name !== 'string' || typeof playerId !== 'string') {
          return ack({ ok: false, error: 'BAD_REQUEST' });
        }
        if (playerId === '' || playerId.length > 64) return ack({ ok: false, error: 'BAD_REQUEST' });
        const room = rooms.getRoom(pin);
        if (!room) return ack({ ok: false, error: 'ROOM_NOT_FOUND' });
        const res = joinPlayer(room, { playerId, name, socketId: socket.id });
        if (!res.ok) return ack(res);
        // The actual id may differ from the one sent: taking over a disconnected namesake keeps their id.
        socket.data = { role: 'player', pin, playerId: res.playerId };
        ack({ ok: true });
        afterChange(room);
      }),
    );

    socket.on('disconnect', () => {
      const { role, pin } = socket.data;
      if (role !== 'player' || !pin) return; // A host leaving does not stop the game.
      const room = rooms.getRoom(pin);
      if (room && disconnectPlayer(room, socket.id)) afterChange(room);
    });
  });
}

/** Any socket that sends host:create / host:join with the room's PIN becomes one of its hosts. */
function attachHost(socket: QuizSocket, pin: string): void {
  if (socket.data.role === 'host' && socket.data.pin && socket.data.pin !== pin) {
    socket.leave('host:' + socket.data.pin);
  }
  socket.data = { role: 'host', pin };
  socket.join('host:' + pin);
}

/**
 * Wraps an event handler so that no incoming message can crash the server:
 * events without an ack callback are ignored, and an exception becomes a BAD_REQUEST ack.
 */
function safe(handler: (payload: unknown, ack: Reply) => void) {
  return (...args: unknown[]): void => {
    const callback = args[args.length - 1];
    if (typeof callback !== 'function') return;
    const ack: Reply = (res) => {
      callback(res);
    };
    // host:next has no payload: its only argument is the ack itself.
    const payload = args.length > 1 ? args[0] : undefined;
    try {
      handler(payload, ack);
    } catch (err) {
      console.error(err);
      ack({ ok: false, error: 'BAD_REQUEST' });
    }
  };
}

/** Reads one field of an untrusted payload (which may be null, a number, anything). */
function field(payload: unknown, key: string): unknown {
  if (typeof payload !== 'object' || payload === null) return undefined;
  return (payload as Record<string, unknown>)[key];
}
