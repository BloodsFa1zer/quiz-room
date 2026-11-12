import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS, type Quiz } from '@quiz/shared';
import {
  advance,
  createRoomState,
  disconnectPlayer,
  joinPlayer,
  reveal,
  shouldAutoReveal,
  submitAnswer,
} from './engine';
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

/** Room with players a (Оля) and b (Тарас), both connected, still in lobby. */
function roomWithPlayers(quiz = makeQuiz()): Room {
  const room = createRoomState('123456', quiz, 1_000);
  join(room, 'a', 'Оля');
  join(room, 'b', 'Тарас');
  return room;
}

function score(room: Room, id: string): number | undefined {
  return room.players.get(id)?.score;
}

describe('advance', () => {
  it('walks the full path of a 2-question quiz', () => {
    const room = roomWithPlayers();
    expect(advance(room, 10_000)).toEqual({ ok: true });
    expect(room).toMatchObject({ phase: 'question', questionIndex: 0, questionStartedAt: 10_000, endsAt: 20_000 });
    expect(advance(room, 12_000)).toEqual({ ok: true });
    expect(room).toMatchObject({ phase: 'reveal', questionIndex: 0, endsAt: null });
    expect(advance(room, 13_000)).toEqual({ ok: true });
    expect(room).toMatchObject({ phase: 'leaderboard', questionIndex: 0 });
    expect(advance(room, 14_000)).toEqual({ ok: true });
    expect(room).toMatchObject({ phase: 'question', questionIndex: 1, questionStartedAt: 14_000, endsAt: 34_000 });
    expect(advance(room, 15_000)).toEqual({ ok: true });
    expect(room.phase).toBe('reveal');
    expect(advance(room, 16_000)).toEqual({ ok: true });
    expect(room).toMatchObject({ phase: 'finished', questionIndex: 1 });
    expect(advance(room, 17_000)).toEqual({ ok: false, error: 'GAME_FINISHED' });
  });

  it('refuses to start without players', () => {
    const room = makeRoom();
    expect(advance(room, 0)).toEqual({ ok: false, error: 'NO_PLAYERS' });
    expect(room.phase).toBe('lobby');
  });

  it('goes from reveal straight to finished for a 1-question quiz', () => {
    const quiz = makeQuiz();
    quiz.questions = quiz.questions.slice(0, 1);
    const room = roomWithPlayers(quiz);
    advance(room, 0);
    advance(room, 1);
    expect(room.phase).toBe('reveal');
    advance(room, 2);
    expect(room.phase).toBe('finished');
  });

  it('clears the answers when the next question starts', () => {
    const room = roomWithPlayers();
    advance(room, 0);
    submitAnswer(room, 'a', 1, 100);
    advance(room, 200);
    advance(room, 300);
    advance(room, 400);
    expect(room.answers.size).toBe(0);
  });
});

describe('submitAnswer', () => {
  it('checks errors in order: phase, player, already answered, option', () => {
    const room = roomWithPlayers();
    expect(submitAnswer(room, 'nobody', 99, 0)).toEqual({ ok: false, error: 'NOT_ACCEPTING_ANSWERS' });
    advance(room, 10_000);
    expect(submitAnswer(room, 'nobody', 99, 10_100)).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
    expect(submitAnswer(room, 'a', 1, 10_100)).toEqual({ ok: true });
    expect(submitAnswer(room, 'a', 99, 10_200)).toEqual({ ok: false, error: 'ALREADY_ANSWERED' });
    for (const bad of [-1, 3, 1.5, Number.NaN]) {
      expect(submitAnswer(room, 'b', bad, 10_200)).toEqual({ ok: false, error: 'INVALID_OPTION' });
    }
    expect(room.answers.has('b')).toBe(false);
  });

  it('remembers points but adds them to the score only at reveal', () => {
    const room = roomWithPlayers();
    advance(room, 10_000);
    submitAnswer(room, 'a', 1, 15_000); // correct, half of the 10 s limit
    submitAnswer(room, 'b', 0, 11_000); // wrong
    expect(room.answers.get('a')).toEqual({ optionIndex: 1, correct: true, points: 750 });
    expect(room.answers.get('b')).toEqual({ optionIndex: 0, correct: false, points: 0 });
    expect(score(room, 'a')).toBe(0);
    reveal(room);
    expect(score(room, 'a')).toBe(750);
    expect(score(room, 'b')).toBe(0);
    expect(room.players.get('a')?.lastPoints).toBe(750);
  });

  it('gives lastPoints 0 to a player who did not answer, even after earning points before', () => {
    const room = roomWithPlayers();
    advance(room, 0);
    submitAnswer(room, 'a', 1, 0);
    advance(room, 1); // reveal
    expect(room.players.get('a')?.lastPoints).toBe(1000);
    advance(room, 2); // leaderboard
    advance(room, 3); // question 1
    advance(room, 4); // reveal, nobody answered
    expect(room.players.get('a')).toMatchObject({ lastPoints: 0, score: 1000 });
  });
});

describe('shouldAutoReveal', () => {
  it('is true when every connected player answered', () => {
    const room = roomWithPlayers();
    advance(room, 0);
    submitAnswer(room, 'a', 1, 1);
    submitAnswer(room, 'b', 1, 1);
    expect(shouldAutoReveal(room)).toBe(true);
  });

  it('is false while a connected player has not answered', () => {
    const room = roomWithPlayers();
    advance(room, 0);
    submitAnswer(room, 'a', 1, 1);
    expect(shouldAutoReveal(room)).toBe(false);
  });

  it('ignores players who are disconnected', () => {
    const room = roomWithPlayers();
    advance(room, 0);
    submitAnswer(room, 'a', 1, 1);
    disconnectPlayer(room, 's-b');
    expect(shouldAutoReveal(room)).toBe(true);
  });

  it('is false when nobody is connected', () => {
    const room = roomWithPlayers();
    advance(room, 0);
    disconnectPlayer(room, 's-a');
    disconnectPlayer(room, 's-b');
    expect(shouldAutoReveal(room)).toBe(false);
  });

  it('is false outside the question phase', () => {
    const room = roomWithPlayers();
    expect(shouldAutoReveal(room)).toBe(false);
    advance(room, 0);
    submitAnswer(room, 'a', 1, 1);
    submitAnswer(room, 'b', 1, 1);
    reveal(room);
    expect(shouldAutoReveal(room)).toBe(false);
  });
});
