import { describe, expect, it } from 'vitest';
import {
  LEADERBOARD_SIZE,
  MAX_NAME_LENGTH,
  MAX_OPTION_LENGTH,
  MAX_OPTIONS,
  MAX_QUESTION_LENGTH,
  MIN_OPTIONS,
  isValidPin,
  type HostState,
  type LeaderboardEntry,
  type PlayerState,
} from '@quiz/shared';
import { hostFixtures, playerFixtures } from './states';

// The phase table of docs/00-common.md §6.3, written as checks.

/** Fields that the host and the player snapshot have in common. */
function expectBaseRules(state: HostState | PlayerState) {
  const { phase, question, questionIndex, questionCount, correctIndex } = state;
  const hasQuestion = phase === 'question' || phase === 'reveal' || phase === 'leaderboard';
  const isRevealed = phase === 'reveal' || phase === 'leaderboard';

  expect(isValidPin(state.pin)).toBe(true);
  expect(questionCount).toBeGreaterThan(0);

  if (phase === 'lobby') {
    expect(questionIndex).toBe(-1);
  } else if (phase === 'finished') {
    expect(questionIndex).toBe(questionCount - 1);
  } else {
    expect(questionIndex).toBeGreaterThanOrEqual(0);
    expect(questionIndex).toBeLessThan(questionCount);
  }

  expect(question !== null).toBe(hasQuestion);
  expect(state.endsAt !== null).toBe(phase === 'question');
  expect(correctIndex !== null).toBe(isRevealed);

  if (question !== null) {
    expect(question.options.length).toBeGreaterThanOrEqual(MIN_OPTIONS);
    expect(question.options.length).toBeLessThanOrEqual(MAX_OPTIONS);
    if (correctIndex !== null) {
      expect(correctIndex).toBeGreaterThanOrEqual(0);
      expect(correctIndex).toBeLessThan(question.options.length);
    }
  }
}

/** Sorted by score, best first; ranks go 1, 2, 3… without gaps or shared places. */
function expectSortedLeaderboard(entries: LeaderboardEntry[]) {
  entries.forEach((entry, i) => {
    expect(entry.rank).toBe(i + 1);
    if (i > 0) expect(entry.score).toBeLessThanOrEqual(entries[i - 1].score);
  });
}

function expectHostRules(state: HostState) {
  const { phase, question, answerCounts } = state;
  const isRevealed = phase === 'reveal' || phase === 'leaderboard';

  expect(answerCounts !== null).toBe(isRevealed);
  if (answerCounts !== null && question !== null) {
    expect(answerCounts).toHaveLength(question.options.length);
    // Every answer is counted under exactly one option.
    expect(answerCounts.reduce((sum, count) => sum + count, 0)).toBe(state.answeredCount);
  }

  if (phase === 'lobby' || phase === 'finished') expect(state.answeredCount).toBe(0);
  expect(state.answeredCount).toBeLessThanOrEqual(state.players.length);

  expect(state.leaderboard).toHaveLength(state.players.length);
  expectSortedLeaderboard(state.leaderboard);
  if (phase === 'lobby') {
    expect(state.leaderboard.every((entry) => entry.score === 0 && entry.lastPoints === 0)).toBe(true);
  }
}

function expectPlayerRules(state: PlayerState) {
  const { phase, question, myAnswer, me } = state;
  const isRevealed = phase === 'reveal' || phase === 'leaderboard';

  expect(state.lastResult !== null).toBe(isRevealed);
  if (question === null) {
    expect(myAnswer).toBeNull();
  } else if (myAnswer !== null) {
    expect(myAnswer).toBeGreaterThanOrEqual(0);
    expect(myAnswer).toBeLessThan(question.options.length);
  }
  // A player who did not answer gets nothing.
  if (state.lastResult !== null && myAnswer === null) {
    expect(state.lastResult).toEqual({ correct: false, points: 0 });
  }

  if (phase === 'lobby') expect(me.score).toBe(0);
  expect(me.rank).toBeGreaterThanOrEqual(1);
  expect(me.rank).toBeLessThanOrEqual(state.playerCount);

  expect(state.top).toHaveLength(Math.min(LEADERBOARD_SIZE, state.playerCount));
  expectSortedLeaderboard(state.top);
  // The player's own row is in `top` exactly when the rank is high enough, and it matches `me`.
  const myRow = state.top.find((entry) => entry.playerId === me.id);
  expect(myRow !== undefined).toBe(me.rank <= state.top.length);
  if (myRow !== undefined) {
    expect(myRow.rank).toBe(me.rank);
    expect(myRow.score).toBe(me.score);
  }
}

describe('every fixture is a valid snapshot (phase table §6.3)', () => {
  for (const [key, state] of Object.entries(hostFixtures)) {
    it(`host/${key}`, () => {
      expectBaseRules(state);
      expectHostRules(state);
    });
  }

  for (const [key, state] of Object.entries(playerFixtures)) {
    it(`player/${key}`, () => {
      expectBaseRules(state);
      expectPlayerRules(state);
    });
  }
});

describe('host fixtures of stage B2', () => {
  it('has the twelve fixtures of the plan, in the order of the gallery', () => {
    expect(Object.keys(hostFixtures)).toEqual([
      'lobby-empty',
      'lobby-few',
      'lobby-full',
      'question-4',
      'question-2',
      'question-3',
      'question-long',
      'reveal-4',
      'reveal-none',
      'leaderboard',
      'finished-many',
      'finished-two',
    ]);
  });

  it('has the right phase in every fixture', () => {
    for (const [key, state] of Object.entries(hostFixtures)) {
      // 'question-long' → 'question', 'leaderboard' → 'leaderboard'
      expect(state.phase).toBe(key.split('-')[0]);
    }
  });

  it('lobby: empty, three players with one offline, forty players with the longest names', () => {
    expect(hostFixtures['lobby-empty'].players).toHaveLength(0);

    expect(hostFixtures['lobby-few'].players.map((player) => player.connected)).toEqual([true, false, true]);

    const full = hostFixtures['lobby-full'].players;
    expect(full).toHaveLength(40);
    expect(full.every((player) => player.name.length === MAX_NAME_LENGTH)).toBe(true);
    expect(new Set(full.map((player) => player.name)).size).toBe(40);
  });

  it('question: 4, 2 and 3 options; 12 of 20 answered; the longest texts', () => {
    const four = hostFixtures['question-4'];
    expect(four.question?.options).toHaveLength(4);
    expect(four.answeredCount).toBe(12);
    expect(four.players).toHaveLength(20);

    expect(hostFixtures['question-2'].question?.options).toEqual(['Так', 'Ні']);
    expect(hostFixtures['question-3'].question?.options).toHaveLength(3);

    const long = hostFixtures['question-long'].question;
    expect(long?.text).toHaveLength(MAX_QUESTION_LENGTH);
    expect(long?.options.map((option) => option.length)).toEqual(Array(4).fill(MAX_OPTION_LENGTH));
  });

  it('reveal: answers split 3 / 9 / 2 / 6 with the second option correct; nobody answered', () => {
    const reveal = hostFixtures['reveal-4'];
    expect(reveal.answerCounts).toEqual([3, 9, 2, 6]);
    expect(reveal.correctIndex).toBe(1);
    // Exactly the nine players who chose the correct option earned points.
    expect(reveal.leaderboard.filter((entry) => entry.lastPoints > 0)).toHaveLength(9);

    const none = hostFixtures['reveal-none'];
    expect(none.answerCounts).toEqual([0, 0, 0, 0]);
    expect(none.answeredCount).toBe(0);
    expect(none.leaderboard.every((entry) => entry.lastPoints === 0)).toBe(true);
  });

  it('leaderboard: 12 players, every row of the top five earned points', () => {
    const { leaderboard } = hostFixtures['leaderboard'];
    expect(leaderboard).toHaveLength(12);
    expect(leaderboard.slice(0, LEADERBOARD_SIZE).every((entry) => entry.lastPoints > 0)).toBe(true);
  });

  it('finished: 12 players and 2 players', () => {
    expect(hostFixtures['finished-many'].leaderboard).toHaveLength(12);
    expect(hostFixtures['finished-two'].leaderboard).toHaveLength(2);
  });
});
