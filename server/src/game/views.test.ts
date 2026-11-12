import { describe, expect, it } from 'vitest';
import { LEADERBOARD_SIZE, type Quiz } from '@quiz/shared';
import { advance, createRoomState, disconnectPlayer, joinPlayer, reveal, submitAnswer } from './engine';
import type { Room } from './types';
import { buildHostState, buildLeaderboard, buildPlayerState } from './views';

const NOW = 50_000;

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

/** Room with players Оля, Тарас, Ірина (joined in that order). */
function makeRoom(): Room {
  const room = createRoomState('123456', makeQuiz(), 1_000);
  for (const [id, name] of [['o', 'Оля'], ['t', 'Тарас'], ['i', 'Ірина']]) {
    joinPlayer(room, { playerId: id, name, socketId: 's-' + id });
  }
  return room;
}

describe('lobby snapshots', () => {
  it('host state matches the lobby column of §6.3', () => {
    const room = makeRoom();
    disconnectPlayer(room, 's-t');
    const state = buildHostState(room, NOW);
    expect(state).toEqual({
      pin: '123456',
      phase: 'lobby',
      quizTitle: 'Тест',
      questionIndex: -1,
      questionCount: 2,
      question: null,
      endsAt: null,
      correctIndex: null,
      serverNow: NOW,
      players: [
        { id: 'o', name: 'Оля', score: 0, connected: true },
        { id: 't', name: 'Тарас', score: 0, connected: false },
        { id: 'i', name: 'Ірина', score: 0, connected: true },
      ],
      answeredCount: 0,
      answerCounts: null,
      leaderboard: [
        { playerId: 'o', name: 'Оля', score: 0, rank: 1, lastPoints: 0 },
        { playerId: 't', name: 'Тарас', score: 0, rank: 2, lastPoints: 0 },
        { playerId: 'i', name: 'Ірина', score: 0, rank: 3, lastPoints: 0 },
      ],
    });
  });

  it('player state matches the lobby column of §6.3', () => {
    const room = makeRoom();
    const state = buildPlayerState(room, 'i', NOW);
    expect(state).toMatchObject({
      pin: '123456',
      phase: 'lobby',
      quizTitle: 'Тест',
      questionIndex: -1,
      questionCount: 2,
      question: null,
      endsAt: null,
      correctIndex: null,
      serverNow: NOW,
      me: { id: 'i', name: 'Ірина', score: 0, rank: 3 },
      playerCount: 3,
      myAnswer: null,
      lastResult: null,
    });
    expect(state.top.map((e) => e.name)).toEqual(['Оля', 'Тарас', 'Ірина']);
  });

  it('leaderboard ranks everybody by join order while scores are equal', () => {
    expect(buildLeaderboard(makeRoom()).map((e) => [e.name, e.rank])).toEqual([
      ['Оля', 1],
      ['Тарас', 2],
      ['Ірина', 3],
    ]);
  });
});

/** Question 0 started at 10 000: Оля answered correctly at once, Тарас wrongly, Ірина did not answer. */
function roomInQuestion(): Room {
  const room = makeRoom();
  advance(room, 10_000);
  submitAnswer(room, 'o', 1, 10_000);
  submitAnswer(room, 't', 0, 12_000);
  return room;
}

describe('question snapshots', () => {
  it('host state hides the answer and shows the scores before the question', () => {
    const state = buildHostState(roomInQuestion(), NOW);
    expect(state).toMatchObject({
      phase: 'question',
      questionIndex: 0,
      question: { text: 'Q1', options: ['A', 'B', 'C'], timeLimitSec: 10 },
      endsAt: 20_000,
      correctIndex: null,
      serverNow: NOW,
      answeredCount: 2,
      answerCounts: null,
    });
    expect(state.question).not.toHaveProperty('correctIndex');
    expect(state.leaderboard.map((e) => e.score)).toEqual([0, 0, 0]);
  });

  it('player state shows only the own answer and no result', () => {
    const room = roomInQuestion();
    expect(buildPlayerState(room, 'o', NOW)).toMatchObject({
      phase: 'question', correctIndex: null, endsAt: 20_000, myAnswer: 1, lastResult: null, me: { score: 0 },
    });
    expect(buildPlayerState(room, 't', NOW).myAnswer).toBe(0);
    expect(buildPlayerState(room, 'i', NOW).myAnswer).toBeNull();
  });
});

describe('reveal and leaderboard snapshots', () => {
  for (const phase of ['reveal', 'leaderboard'] as const) {
    it(`${phase}: host state shows the answer, counts and updated scores`, () => {
      const room = roomInQuestion();
      reveal(room);
      if (phase === 'leaderboard') advance(room, 30_000);
      const state = buildHostState(room, NOW);
      expect(state).toMatchObject({
        phase,
        questionIndex: 0,
        question: { text: 'Q1' },
        endsAt: null,
        correctIndex: 1,
        answeredCount: 2,
        answerCounts: [1, 1, 0],
      });
      expect(state.answerCounts).toHaveLength(3);
      expect(state.leaderboard).toEqual([
        { playerId: 'o', name: 'Оля', score: 1000, rank: 1, lastPoints: 1000 },
        { playerId: 't', name: 'Тарас', score: 0, rank: 2, lastPoints: 0 },
        { playerId: 'i', name: 'Ірина', score: 0, rank: 3, lastPoints: 0 },
      ]);
    });

    it(`${phase}: player results for correct, wrong and no answer`, () => {
      const room = roomInQuestion();
      reveal(room);
      if (phase === 'leaderboard') advance(room, 30_000);
      expect(buildPlayerState(room, 'o', NOW)).toMatchObject({
        phase, correctIndex: 1, myAnswer: 1, lastResult: { correct: true, points: 1000 }, me: { score: 1000, rank: 1 },
      });
      expect(buildPlayerState(room, 't', NOW)).toMatchObject({
        myAnswer: 0, lastResult: { correct: false, points: 0 }, me: { score: 0, rank: 2 },
      });
      expect(buildPlayerState(room, 'i', NOW)).toMatchObject({
        myAnswer: null, lastResult: { correct: false, points: 0 }, me: { score: 0, rank: 3 },
      });
    });
  }
});

describe('finished snapshots', () => {
  function finishedRoom(): Room {
    const room = roomInQuestion();
    advance(room, 11_000); // reveal
    advance(room, 12_000); // leaderboard
    advance(room, 13_000); // question 1
    submitAnswer(room, 'i', 0, 13_000);
    advance(room, 14_000); // reveal
    advance(room, 15_000); // finished
    return room;
  }

  it('host state has the final leaderboard and no question', () => {
    const state = buildHostState(finishedRoom(), NOW);
    expect(state).toMatchObject({
      phase: 'finished',
      questionIndex: 1,
      question: null,
      endsAt: null,
      correctIndex: null,
      answeredCount: 0,
      answerCounts: null,
    });
    expect(state.leaderboard.map((e) => [e.name, e.score, e.rank])).toEqual([
      ['Оля', 1000, 1],
      ['Ірина', 1000, 2],
      ['Тарас', 0, 3],
    ]);
  });

  it('player state has the final score and no answer or result', () => {
    expect(buildPlayerState(finishedRoom(), 'i', NOW)).toMatchObject({
      phase: 'finished', question: null, myAnswer: null, lastResult: null, me: { score: 1000, rank: 2 },
    });
  });
});

describe('leaderboard order', () => {
  it('sorts by score and breaks ties by join order', () => {
    const room = makeRoom();
    const scores: Record<string, number> = { o: 500, t: 800, i: 800 };
    for (const player of room.players.values()) player.score = scores[player.id];
    expect(buildLeaderboard(room).map((e) => [e.name, e.rank])).toEqual([
      ['Тарас', 1],
      ['Ірина', 2],
      ['Оля', 3],
    ]);
  });

  it('player top has at most LEADERBOARD_SIZE entries', () => {
    const room = makeRoom();
    for (let i = 0; i < 4; i++) joinPlayer(room, { playerId: `x${i}`, name: `Гравець ${i}`, socketId: `s-x${i}` });
    expect(room.players.size).toBe(7);
    expect(buildPlayerState(room, 'o', NOW).top).toHaveLength(LEADERBOARD_SIZE);
    expect(buildHostState(room, NOW).leaderboard).toHaveLength(7);
  });
});
