import { isValidPin, type Ack } from '@quiz/shared';
import type { QuizStore } from '../quiz/quizStore';
import { advance, disconnectPlayer, joinPlayer, reveal, shouldAutoReveal, submitAnswer } from './engine';
import type { RoomManager } from './roomManager';
import type { QuizServer, QuizSocket, Room } from './types';
import { buildHostState, buildLeaderboard, buildPlayerState } from './views';

/** Every ack in the contract is a plain Ack, except host:create, which also returns the PIN. */
type Reply = (res: Ack | Ack<{ pin: string }>) => void;

interface Deps {
  store: QuizStore;
  rooms: RoomManager;
  roomTtlMs: number;
}

// The only place with side effects: sockets, timers, Date.now() and logs. The rules themselves live in engine.ts.
export function registerSocketHandlers(io: QuizServer, deps: Deps): void {
  const { store, rooms, roomTtlMs } = deps;
  /** Last phase written to the log, per room, so each phase change is logged exactly once. */
  const loggedPhase = new Map<string, string>();

  /** Sends a full snapshot to every host socket of the room and a personal one to every connected player. */
  function broadcast(room: Room): void {
    const now = Date.now();
    io.to('host:' + room.pin).emit('host:state', buildHostState(room, now));
    for (const player of room.players.values()) {
      if (player.socketId) io.to(player.socketId).emit('player:state', buildPlayerState(room, player.id, now));
    }
  }

  /**
   * Keeps exactly one timer per room, armed only during `question`.
   * Safe to call after every change: the deadline comes from endsAt instead of being counted again.
   */
  function syncTimer(room: Room): void {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    if (room.phase !== 'question' || room.endsAt === null) return;
    room.timer = setTimeout(() => {
      room.timer = null;
      if (room.phase !== 'question') return;
      reveal(room);
      afterChange(room);
    }, Math.max(0, room.endsAt - Date.now()));
  }

  /** The single place to call after ANY change to a room. */
  function afterChange(room: Room): void {
    syncTimer(room);
    logPhase(room);
    broadcast(room);
  }

  /** Called by the room's lifetime timer: tells everybody, then forgets the room. */
  function closeRoom(pin: string): void {
    const room = rooms.getRoom(pin);
    if (!room) return;
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    io.to('host:' + pin).emit('room:closed');
    for (const player of room.players.values()) {
      if (player.socketId) io.to(player.socketId).emit('room:closed');
    }
    // Old host sockets must not receive snapshots of a future room that happens to get the same PIN.
    io.in('host:' + pin).socketsLeave('host:' + pin);
    rooms.deleteRoom(pin);
    loggedPhase.delete(pin);
    log(pin, 'кімнату закрито');
  }

  function logPhase(room: Room): void {
    const key = `${room.phase}:${room.questionIndex}`;
    if (loggedPhase.get(room.pin) === key) return;
    loggedPhase.set(room.pin, key);
    if (room.phase === 'question') {
      log(room.pin, `питання ${room.questionIndex + 1}/${room.quiz.questions.length}`);
    } else if (room.phase === 'reveal') {
      log(room.pin, `reveal: відповіли ${room.answers.size}/${room.players.size}`);
    } else if (room.phase === 'finished') {
      const [winner] = buildLeaderboard(room);
      log(room.pin, `фінал: перше місце — ${winner?.name} (${winner?.score})`);
    }
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
        log(room.pin, `кімнату створено: «${quiz.title}»`);
        // unref(): this long timer alone must not keep the Node process alive (G10).
        setTimeout(() => closeRoom(room.pin), roomTtlMs).unref();
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
        const countBefore = room.players.size;
        const res = joinPlayer(room, { playerId, name, socketId: socket.id });
        if (!res.ok) return ack(res);
        // The actual id may differ from the one sent: taking over a disconnected namesake keeps their id.
        socket.data = { role: 'player', pin, playerId: res.playerId };
        ack({ ok: true });
        const joinedName = room.players.get(res.playerId)?.name;
        if (room.players.size > countBefore) log(pin, `гравець зайшов: ${joinedName} (усього ${room.players.size})`);
        else log(pin, `перепідключення: ${joinedName}`);
        afterChange(room);
      }),
    );

    socket.on(
      'host:next',
      safe((_payload, ack) => {
        const { role, pin } = socket.data;
        const room = role === 'host' && pin ? rooms.getRoom(pin) : undefined;
        if (!room) return ack({ ok: false, error: 'NOT_IN_ROOM' });
        const res = advance(room, Date.now());
        ack(res);
        if (res.ok) afterChange(room);
      }),
    );

    socket.on(
      'player:answer',
      safe((payload, ack) => {
        const { role, pin, playerId } = socket.data;
        const room = role === 'player' && pin ? rooms.getRoom(pin) : undefined;
        if (!room || !playerId) return ack({ ok: false, error: 'NOT_IN_ROOM' });
        const optionIndex = field(payload, 'optionIndex');
        if (typeof optionIndex !== 'number') return ack({ ok: false, error: 'BAD_REQUEST' });
        const res = submitAnswer(room, playerId, optionIndex, Date.now());
        ack(res);
        if (!res.ok) return;
        if (shouldAutoReveal(room)) reveal(room);
        afterChange(room);
      }),
    );

    socket.on('disconnect', () => {
      const { role, pin } = socket.data;
      if (role !== 'player' || !pin) return; // A host leaving does not stop the game.
      const room = rooms.getRoom(pin);
      const player = room ? disconnectPlayer(room, socket.id) : null;
      if (!room || !player) return;
      log(pin, `відключення: ${player.name}`);
      // Otherwise the game would wait for the timer if the last player who had not answered left.
      if (shouldAutoReveal(room)) reveal(room);
      afterChange(room);
    });
  });
}

/** One line per room event, PIN first, so the log of a single game is easy to follow. */
function log(pin: string, message: string): void {
  console.log(`[${pin}] ${message}`);
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
