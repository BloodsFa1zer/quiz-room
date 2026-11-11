import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateQuizInput, type QuizInput } from '@quiz/shared';
import { createQuizStore } from './quizStore';
import { SEED_QUIZZES } from './seed';

const input: QuizInput = {
  title: 'Тест',
  questions: [{ text: '2+2?', options: ['3', '4'], correctIndex: 1, timeLimitSec: 10 }],
};

let dir: string;
let file: string;

beforeEach(() => {
  dir = join(tmpdir(), `quiz-store-${process.pid}-${Math.random().toString(36).slice(2)}`);
  file = join(dir, 'quizzes.json');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('createQuizStore', () => {
  it('creates the file with the 2 demo quizzes when it does not exist', () => {
    const store = createQuizStore(file);
    expect(store.list()).toHaveLength(2);
    expect(existsSync(file)).toBe(true);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toHaveLength(2);
  });

  it('replaces a broken file with the demo quizzes', () => {
    createQuizStore(file);
    writeFileSync(file, '{ not json');
    const store = createQuizStore(file);
    expect(store.list()).toHaveLength(2);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toHaveLength(2);
    expect(console.warn).toHaveBeenCalled();
  });

  it('get returns what create returned', () => {
    const store = createQuizStore(file);
    const quiz = store.create(input);
    expect(store.get(quiz.id)).toEqual(quiz);
    expect(quiz.createdAt).toBe(quiz.updatedAt);
  });

  it('update changes updatedAt and keeps id and createdAt', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000);
    const store = createQuizStore(file);
    const quiz = store.create(input);
    vi.setSystemTime(2_000);
    const updated = store.update(quiz.id, { ...input, title: 'Новий' });
    expect(updated).toMatchObject({ id: quiz.id, createdAt: 1_000, updatedAt: 2_000, title: 'Новий' });
    expect(store.get(quiz.id)?.title).toBe('Новий');
  });

  it('update and remove of an unknown id return undefined and false', () => {
    const store = createQuizStore(file);
    expect(store.update('nope', input)).toBeUndefined();
    expect(store.remove('nope')).toBe(false);
    expect(store.list()).toHaveLength(2);
  });

  it('remove deletes the quiz', () => {
    const store = createQuizStore(file);
    const quiz = store.create(input);
    expect(store.remove(quiz.id)).toBe(true);
    expect(store.get(quiz.id)).toBeUndefined();
  });

  it('list is sorted by updatedAt descending and has the right questionCount', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000);
    const store = createQuizStore(file);
    vi.setSystemTime(2_000);
    const older = store.create(input);
    vi.setSystemTime(3_000);
    const newer = store.create({ ...input, questions: [...input.questions, ...input.questions] });
    const list = store.list();
    expect(list.map((q) => q.id).slice(0, 2)).toEqual([newer.id, older.id]);
    expect(list[0]).toEqual({ id: newer.id, title: 'Тест', questionCount: 2, updatedAt: 3_000 });
    expect(list[1].questionCount).toBe(1);
    const updatedAts = list.map((q) => q.updatedAt);
    expect(updatedAts).toEqual([...updatedAts].sort((a, b) => b - a));
  });

  it('a new store on the same file sees saved data', () => {
    const quiz = createQuizStore(file).create(input);
    const reopened = createQuizStore(file);
    expect(reopened.get(quiz.id)).toEqual(quiz);
    expect(reopened.list()).toHaveLength(3);
  });

  it('stores all strings trimmed', () => {
    const store = createQuizStore(file);
    const quiz = store.create({
      title: '  Тест  ',
      questions: [{ text: ' 2+2? ', options: [' 3', '4 '], correctIndex: 1, timeLimitSec: 10 }],
    });
    expect(quiz.title).toBe('Тест');
    expect(quiz.questions[0]).toEqual({ text: '2+2?', options: ['3', '4'], correctIndex: 1, timeLimitSec: 10 });
    expect(createQuizStore(file).get(quiz.id)?.title).toBe('Тест');
  });
});

describe('SEED_QUIZZES', () => {
  it('has exactly 2 quizzes with 6 and 5 questions', () => {
    expect(SEED_QUIZZES).toHaveLength(2);
    expect(SEED_QUIZZES.map((q) => q.questions.length)).toEqual([6, 5]);
  });

  it('every demo quiz passes validateQuizInput', () => {
    for (const quiz of SEED_QUIZZES) {
      expect(validateQuizInput(quiz)).toEqual([]);
    }
  });
});
