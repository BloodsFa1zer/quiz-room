import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Quiz, QuizInput, QuizSummary } from '@quiz/shared';
import { SEED_QUIZZES } from './seed';

export interface QuizStore {
  /** Newest (by updatedAt) first. */
  list(): QuizSummary[];
  get(id: string): Quiz | undefined;
  create(input: QuizInput): Quiz;
  /** Keeps id and createdAt. */
  update(id: string, input: QuizInput): Quiz | undefined;
  remove(id: string): boolean;
}

/**
 * Quizzes live in memory; every change rewrites the whole JSON file.
 * The store does not validate input — the REST router does that before calling it.
 */
export function createQuizStore(filePath: string): QuizStore {
  let quizzes = load(filePath);

  function save(): void {
    writeFileSync(filePath, JSON.stringify(quizzes, null, 2));
  }

  return {
    list() {
      return [...quizzes]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((q) => ({ id: q.id, title: q.title, questionCount: q.questions.length, updatedAt: q.updatedAt }));
    },

    get(id) {
      return quizzes.find((q) => q.id === id);
    },

    create(input) {
      const quiz = newQuiz(input, Date.now());
      quizzes.push(quiz);
      save();
      return quiz;
    },

    update(id, input) {
      const old = quizzes.find((q) => q.id === id);
      if (!old) return undefined;
      const quiz: Quiz = { id, ...trimInput(input), createdAt: old.createdAt, updatedAt: Date.now() };
      quizzes = quizzes.map((q) => (q.id === id ? quiz : q));
      save();
      return quiz;
    },

    remove(id) {
      const before = quizzes.length;
      quizzes = quizzes.filter((q) => q.id !== id);
      if (quizzes.length === before) return false;
      save();
      return true;
    },
  };
}

/** Reads the data file; a missing or broken file is replaced with the demo quizzes. */
function load(filePath: string): Quiz[] {
  if (existsSync(filePath)) {
    try {
      const data: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
      if (Array.isArray(data)) return data as Quiz[];
    } catch {
      // Falls through to re-seeding below.
    }
    console.warn(`[store] ${filePath} is not valid quiz data — replacing it with the demo quizzes`);
  }
  const now = Date.now();
  const seeded = SEED_QUIZZES.map((input) => newQuiz(input, now));
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(seeded, null, 2));
  return seeded;
}

function newQuiz(input: QuizInput, now: number): Quiz {
  return { id: randomUUID(), ...trimInput(input), createdAt: now, updatedAt: now };
}

/** Copies only the known fields, with every string trimmed. */
function trimInput(input: QuizInput): QuizInput {
  return {
    title: input.title.trim(),
    questions: input.questions.map((q) => ({
      text: q.text.trim(),
      options: q.options.map((o) => o.trim()),
      correctIndex: q.correctIndex,
      timeLimitSec: q.timeLimitSec,
    })),
  };
}
