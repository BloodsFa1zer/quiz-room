import { describe, expect, it } from 'vitest';
import { DEFAULT_TIME_LIMIT_SEC, MAX_OPTIONS, MIN_OPTIONS, type Quiz } from '@quiz/shared';
import {
  addOption,
  addQuestion,
  draftFromQuiz,
  emptyDraft,
  moveQuestion,
  removeOption,
  removeQuestion,
  toQuizInput,
  updateQuestion,
  type QuizDraft,
} from './quizDraft';

const quiz: Quiz = {
  id: 'q1',
  title: 'Столиці',
  questions: [
    { text: 'Столиця України?', options: ['Львів', 'Київ', 'Одеса'], correctIndex: 1, timeLimitSec: 20 },
    { text: 'Столиця Японії?', options: ['Токіо', 'Осака'], correctIndex: 0, timeLimitSec: 10 },
    { text: 'Столиця Польщі?', options: ['Краків', 'Гданськ', 'Варшава', 'Вроцлав'], correctIndex: 2, timeLimitSec: 30 },
  ],
  createdAt: 1,
  updatedAt: 2,
};

/** A draft with three questions; the first one has three options and the second is correct. */
function sample(): QuizDraft {
  return draftFromQuiz(quiz);
}

function keyOf(draft: QuizDraft, index: number): string {
  return draft.questions[index].key;
}

describe('quizDraft', () => {
  it('emptyDraft has no title and one typical question', () => {
    const draft = emptyDraft();

    expect(draft.title).toBe('');
    expect(draft.questions).toHaveLength(1);
    expect(draft.questions[0]).toMatchObject({
      text: '',
      options: ['', '', '', ''],
      correctIndex: 0,
      timeLimitSec: DEFAULT_TIME_LIMIT_SEC,
    });
    expect(draft.questions[0].key).not.toBe('');
  });

  it('draftFromQuiz → toQuizInput gives back the original title and questions', () => {
    expect(toQuizInput(draftFromQuiz(quiz))).toEqual({ title: quiz.title, questions: quiz.questions });
  });

  it('toQuizInput leaves out the React keys', () => {
    const input = toQuizInput(sample());

    for (const question of input.questions) {
      expect(Object.keys(question).sort()).toEqual(['correctIndex', 'options', 'text', 'timeLimitSec']);
    }
  });

  it('gives every question its own key', () => {
    const draft = addQuestion(sample());
    const keys = new Set(draft.questions.map((q) => q.key));

    expect(keys.size).toBe(4);
  });

  it('addQuestion appends a typical question and removeQuestion removes one by key', () => {
    const draft = sample();
    const added = addQuestion(draft);

    expect(added.questions).toHaveLength(4);
    expect(added.questions[3]).toMatchObject({ text: '', correctIndex: 0, timeLimitSec: DEFAULT_TIME_LIMIT_SEC });

    const removed = removeQuestion(added, keyOf(draft, 1));
    expect(removed.questions.map((q) => q.text)).toEqual(['Столиця України?', 'Столиця Польщі?', '']);
  });

  it('moveQuestion swaps neighbours and does nothing at the edges', () => {
    const draft = sample();

    expect(moveQuestion(draft, keyOf(draft, 0), 1).questions.map((q) => q.text)).toEqual([
      'Столиця Японії?',
      'Столиця України?',
      'Столиця Польщі?',
    ]);
    expect(moveQuestion(draft, keyOf(draft, 2), -1).questions[1].text).toBe('Столиця Польщі?');
    expect(moveQuestion(draft, keyOf(draft, 0), -1)).toEqual(draft);
    expect(moveQuestion(draft, keyOf(draft, 2), 1)).toEqual(draft);
    expect(moveQuestion(draft, 'no-such-key', 1)).toEqual(draft);
  });

  it('updateQuestion changes only the given question', () => {
    const draft = sample();
    const updated = updateQuestion(draft, keyOf(draft, 1), { text: 'Нове питання', timeLimitSec: 60 });

    expect(updated.questions[1]).toMatchObject({ text: 'Нове питання', timeLimitSec: 60, correctIndex: 0 });
    expect(updated.questions[0]).toEqual(draft.questions[0]);
    expect(updated.questions[2]).toEqual(draft.questions[2]);
  });

  it(`addOption adds an empty option and stops at ${MAX_OPTIONS}`, () => {
    const draft = sample();
    const key = keyOf(draft, 0);

    const four = addOption(draft, key);
    expect(four.questions[0].options).toEqual(['Львів', 'Київ', 'Одеса', '']);

    const stillFour = addOption(four, key);
    expect(stillFour.questions[0].options).toHaveLength(MAX_OPTIONS);
    expect(stillFour).toEqual(four);
  });

  it(`removeOption stops at ${MIN_OPTIONS}`, () => {
    const draft = sample();
    const key = keyOf(draft, 1);

    expect(draft.questions[1].options).toHaveLength(MIN_OPTIONS);
    expect(removeOption(draft, key, 0)).toEqual(draft);
  });

  it('removeOption before the correct option keeps the same text marked as correct', () => {
    const draft = sample();
    const after = removeOption(draft, keyOf(draft, 0), 0).questions[0];

    expect(after.options).toEqual(['Київ', 'Одеса']);
    expect(after.correctIndex).toBe(0);
    expect(after.options[after.correctIndex]).toBe('Київ');
  });

  it('removeOption after the correct option leaves correctIndex as it is', () => {
    const draft = sample();
    const after = removeOption(draft, keyOf(draft, 2), 3).questions[2];

    expect(after.options).toEqual(['Краків', 'Гданськ', 'Варшава']);
    expect(after.options[after.correctIndex]).toBe('Варшава');
  });

  it('removeOption of the correct option makes the first option correct', () => {
    const draft = sample();
    const after = removeOption(draft, keyOf(draft, 2), 2).questions[2];

    expect(after.options).toEqual(['Краків', 'Гданськ', 'Вроцлав']);
    expect(after.correctIndex).toBe(0);
  });

  it('removeOption with an index outside the list changes nothing', () => {
    const draft = sample();

    expect(removeOption(draft, keyOf(draft, 0), 5)).toEqual(draft);
    expect(removeOption(draft, keyOf(draft, 0), -1)).toEqual(draft);
  });

  // Each call runs on a fresh draft; the draft must look exactly the same afterwards.
  it.each<[string, (d: QuizDraft) => unknown]>([
    ['toQuizInput', (d) => toQuizInput(d)],
    ['addQuestion', (d) => addQuestion(d)],
    ['removeQuestion', (d) => removeQuestion(d, keyOf(d, 0))],
    ['moveQuestion', (d) => moveQuestion(d, keyOf(d, 0), 1)],
    ['updateQuestion', (d) => updateQuestion(d, keyOf(d, 0), { text: 'Інше', options: ['Так', 'Ні'] })],
    ['addOption', (d) => addOption(d, keyOf(d, 0))],
    ['removeOption', (d) => removeOption(d, keyOf(d, 0), 0)],
  ])('%s does not change its argument', (_name, change) => {
    const draft = sample();
    const before = structuredClone(draft);

    const result = change(draft);

    expect(draft).toEqual(before);
    expect(result).not.toBe(draft);
  });

  it('draftFromQuiz does not share option arrays with the quiz', () => {
    const before = structuredClone(quiz);
    const draft = draftFromQuiz(quiz);

    draft.questions[0].options.push('змінено');
    draft.questions[0].text = 'змінено';

    expect(quiz).toEqual(before);
  });
});
