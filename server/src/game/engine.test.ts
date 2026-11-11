import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS, type Quiz } from '@quiz/shared';
import { createRoomState, disconnectPlayer, joinPlayer } from './engine';
import type { Room } from './types';

function makeQuiz(): Quiz {
  return {
    id: 'quiz-1',
    title: 'Тест',
    questions: [
      { text: 'Q1', options: ['A', 'B', 'C'], correctIndex: 1, timeLimitSec: 10 },
      { text: 'Q2', options: ['Так', 'Ні'], correctIndex: 0, timeLimitSec: 20 },
    ],
    createdAt: 1,
    updatedAt: 1,
  };
}

function makeRoom(): Room {
  return createRoomState('123456', makeQuiz(), 1_000);
}

function join(room: Room, playerId: string, name: string, socketId = 's-' + playerId) {
  return joinPlayer(room, { playerId, name, socketId });
}

function fillRoom(room: Room, count: number): void {
  for (let i = 0; i < count; i++) join(room, `p${i}`, `Гравець ${i}`);
}

describe('createRoomState', () => {
  it('starts in lobby with questionIndex -1', () => {
    const room = makeRoom();
    expect(room).toMatchObject({ pin: '123456', phase: 'lobby', questionIndex: -1, endsAt: null, createdAt: 1_000 });
    expect(room.players.size).toBe(0);
  });

  it('keeps its own copy of the quiz', () => {
    const quiz = makeQuiz();
    const room = createRoomState('123456', quiz, 0);
    quiz.title = 'Змінено';
    quiz.questions[0].options.push('D');
    quiz.questions.pop();
    expect(room.quiz).toEqual(makeQuiz());
  });
});

describe('joinPlayer', () => {
  it('adds a new player with 0 points in join order', () => {
    const room = makeRoom();
    expect(join(room, 'a', '  Оля  ')).toEqual({ ok: true, playerId: 'a' });
    expect(join(room, 'b', 'Тарас')).toEqual({ ok: true, playerId: 'b' });
    expect(room.players.get('a')).toEqual({
      id: 'a', name: 'Оля', score: 0, lastPoints: 0, socketId: 's-a', joinOrder: 0,
    });
    expect(room.players.get('b')?.joinOrder).toBe(1);
  });

  it('reconnects by playerId, keeping name and score, also in finished', () => {
    const room = makeRoom();
    join(room, 'a', 'Оля');
    const player = room.players.get('a');
    if (!player) throw new Error('no player');
    player.score = 700;
    player.socketId = null;
    room.phase = 'finished';
    expect(joinPlayer(room, { playerId: 'a', name: 'Інше імʼя', socketId: 'new' })).toEqual({ ok: true, playerId: 'a' });
    expect(room.players.get('a')).toMatchObject({ name: 'Оля', score: 700, socketId: 'new' });
    expect(room.players.size).toBe(1);
  });

  it('rejects the name of a connected player ignoring case and outer spaces', () => {
    const room = makeRoom();
    join(room, 'a', 'Оля');
    expect(join(room, 'b', '  оЛЯ ')).toEqual({ ok: false, error: 'NAME_TAKEN' });
    expect(room.players.size).toBe(1);
  });

  it('takes over a disconnected namesake with their id and score', () => {
    const room = makeRoom();
    join(room, 'a', 'Оля');
    const player = room.players.get('a');
    if (!player) throw new Error('no player');
    player.score = 900;
    disconnectPlayer(room, 's-a');
    expect(join(room, 'b', 'ОЛЯ', 'new')).toEqual({ ok: true, playerId: 'a' });
    expect(room.players.get('a')).toMatchObject({ score: 900, socketId: 'new' });
    expect(room.players.has('b')).toBe(false);
  });

  it('rejects an invalid name', () => {
    const room = makeRoom();
    expect(join(room, 'a', '   ')).toEqual({ ok: false, error: 'INVALID_NAME' });
    expect(join(room, 'a', 'а'.repeat(17))).toEqual({ ok: false, error: 'INVALID_NAME' });
    expect(room.players.size).toBe(0);
  });

  it('rejects a new player when the game is finished', () => {
    const room = makeRoom();
    room.phase = 'finished';
    expect(join(room, 'a', 'Оля')).toEqual({ ok: false, error: 'GAME_FINISHED' });
  });

  it('rejects the 51st player', () => {
    const room = makeRoom();
    fillRoom(room, MAX_PLAYERS);
    expect(room.players.size).toBe(50);
    expect(join(room, 'extra', 'Зайвий')).toEqual({ ok: false, error: 'ROOM_FULL' });
  });

  describe('checks rules in the order of §6.5.3', () => {
    it('1. invalid name comes before reconnect', () => {
      const room = makeRoom();
      join(room, 'a', 'Оля');
      expect(join(room, 'a', '')).toEqual({ ok: false, error: 'INVALID_NAME' });
    });

    it('2. reconnect comes before NAME_TAKEN, GAME_FINISHED and ROOM_FULL', () => {
      const room = makeRoom();
      fillRoom(room, MAX_PLAYERS);
      room.phase = 'finished';
      // p1 is still connected and the name belongs to them — reconnect wins anyway.
      expect(join(room, 'p1', 'Гравець 1', 'new')).toEqual({ ok: true, playerId: 'p1' });
    });

    it('3. NAME_TAKEN comes before GAME_FINISHED', () => {
      const room = makeRoom();
      join(room, 'a', 'Оля');
      room.phase = 'finished';
      expect(join(room, 'b', 'Оля')).toEqual({ ok: false, error: 'NAME_TAKEN' });
    });

    it('3. takeover comes before GAME_FINISHED and ROOM_FULL', () => {
      const room = makeRoom();
      fillRoom(room, MAX_PLAYERS);
      disconnectPlayer(room, 's-p7');
      room.phase = 'finished';
      expect(join(room, 'other', 'гравець 7')).toEqual({ ok: true, playerId: 'p7' });
    });

    it('4. GAME_FINISHED comes before ROOM_FULL', () => {
      const room = makeRoom();
      fillRoom(room, MAX_PLAYERS);
      room.phase = 'finished';
      expect(join(room, 'extra', 'Зайвий')).toEqual({ ok: false, error: 'GAME_FINISHED' });
    });
  });
});

describe('disconnectPlayer', () => {
  it('clears socketId of the player owning the socket', () => {
    const room = makeRoom();
    join(room, 'a', 'Оля');
    const player = disconnectPlayer(room, 's-a');
    expect(player?.id).toBe('a');
    expect(room.players.get('a')?.socketId).toBeNull();
  });

  it('returns null and changes nothing for a foreign socket', () => {
    const room = makeRoom();
    join(room, 'a', 'Оля');
    // The player already reconnected on a new socket; the old one drops later.
    join(room, 'a', 'Оля', 'new');
    expect(disconnectPlayer(room, 's-a')).toBeNull();
    expect(room.players.get('a')?.socketId).toBe('new');
  });
});
