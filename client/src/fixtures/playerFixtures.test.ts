import { describe, expect, it } from 'vitest';
import { MAX_OPTION_LENGTH, MAX_QUESTION_LENGTH } from '@quiz/shared';
import { playerFixtures } from './states';

// What each player fixture of stage B3 shows. That every one is a valid snapshot is checked in `states.test.ts`.

describe('player fixtures of stage B3', () => {
  it('has the thirteen fixtures of the plan, in the order of the gallery', () => {
    expect(Object.keys(playerFixtures)).toEqual([
      'lobby',
      'question-4',
      'question-2',
      'question-3',
      'question-long',
      'answered',
      'reveal-correct',
      'reveal-wrong',
      'reveal-timeout',
      'leaderboard-top',
      'leaderboard-low',
      'finished-winner',
      'finished-low',
    ]);
  });

  it('has the right phase in every fixture', () => {
    for (const [key, state] of Object.entries(playerFixtures)) {
      // 'answered' is the `question` phase after the player's answer.
      expect(state.phase).toBe(key === 'answered' ? 'question' : key.split('-')[0]);
    }
  });

  it('question: 4, 2 and 3 options, the longest texts, nothing answered yet; answered: option C', () => {
    const keys = ['question-4', 'question-2', 'question-3'];
    expect(keys.map((key) => playerFixtures[key].question?.options.length)).toEqual([4, 2, 3]);

    const long = playerFixtures['question-long'].question;
    expect(long?.text).toHaveLength(MAX_QUESTION_LENGTH);
    expect(long?.options.map((option) => option.length)).toEqual(Array(4).fill(MAX_OPTION_LENGTH));

    for (const key of ['question-4', 'question-2', 'question-3', 'question-long']) {
      expect(playerFixtures[key].myAnswer).toBeNull();
    }
    expect(playerFixtures['answered'].myAnswer).toBe(2);
  });

  it('reveal: correct for 850 points, wrong after an answer, no answer at all', () => {
    expect(playerFixtures['reveal-correct'].lastResult).toEqual({ correct: true, points: 850 });

    const wrong = playerFixtures['reveal-wrong'];
    expect(wrong.lastResult).toEqual({ correct: false, points: 0 });
    expect(wrong.myAnswer).not.toBeNull();

    const timeout = playerFixtures['reveal-timeout'];
    expect(timeout.myAnswer).toBeNull();
    expect(timeout.lastResult).toEqual({ correct: false, points: 0 });
  });

  it('leaderboard: first place inside the top five, 14th place outside it', () => {
    const top = playerFixtures['leaderboard-top'];
    expect(top.me.rank).toBe(1);
    expect(top.top.some((entry) => entry.playerId === top.me.id)).toBe(true);

    const low = playerFixtures['leaderboard-low'];
    expect(low.me.rank).toBe(14);
    expect(low.top.some((entry) => entry.playerId === low.me.id)).toBe(false);
  });

  it('finished: first place, and 9th place of 12', () => {
    expect(playerFixtures['finished-winner'].me.rank).toBe(1);

    const low = playerFixtures['finished-low'];
    expect([low.me.rank, low.playerCount]).toEqual([9, 12]);
  });
});
