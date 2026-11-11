import { describe, expect, it } from 'vitest';
import type { Quiz } from '@quiz/shared';
import { createRoomState, disconnectPlayer, joinPlayer } from './engine';
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
