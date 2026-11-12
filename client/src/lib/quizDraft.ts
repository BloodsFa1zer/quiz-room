import {
  DEFAULT_TIME_LIMIT_SEC,
  MAX_OPTIONS,
  MIN_OPTIONS,
  type Question,
  type Quiz,
  type QuizInput,
} from '@quiz/shared';
import { createId } from './id';

/** A question in the editor. `key` only tells React which card is which; it is never sent to the server. */
export type DraftQuestion = Question & { key: string };

export interface QuizDraft {
  title: string;
  questions: DraftQuestion[];
}

// Every function below returns a new draft and never changes its argument, so the editor can keep
// the draft in useState. When there is nothing to change, the result is equal to the argument.

function newQuestion(): DraftQuestion {
  return {
    key: createId(),
    text: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    timeLimitSec: DEFAULT_TIME_LIMIT_SEC,
  };
}

/** Applies `change` to the question with this key and leaves the other questions as they are. */
function mapQuestion(draft: QuizDraft, key: string, change: (q: DraftQuestion) => DraftQuestion): QuizDraft {
  return { ...draft, questions: draft.questions.map((q) => (q.key === key ? change(q) : q)) };
}

export function emptyDraft(): QuizDraft {
  return { title: '', questions: [newQuestion()] };
}

export function draftFromQuiz(quiz: Quiz): QuizDraft {
  return {
    title: quiz.title,
    questions: quiz.questions.map((q) => ({ ...q, options: [...q.options], key: createId() })),
  };
}

export function toQuizInput(draft: QuizDraft): QuizInput {
  return {
    title: draft.title,
    questions: draft.questions.map((q) => ({
      text: q.text,
      options: [...q.options],
      correctIndex: q.correctIndex,
      timeLimitSec: q.timeLimitSec,
    })),
  };
}

export function addQuestion(draft: QuizDraft): QuizDraft {
  return { ...draft, questions: [...draft.questions, newQuestion()] };
}

export function removeQuestion(draft: QuizDraft, key: string): QuizDraft {
  return { ...draft, questions: draft.questions.filter((q) => q.key !== key) };
}

/** Swaps the question with its neighbour above (-1) or below (1). */
export function moveQuestion(draft: QuizDraft, key: string, direction: -1 | 1): QuizDraft {
  const from = draft.questions.findIndex((q) => q.key === key);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= draft.questions.length) return draft;

  const questions = [...draft.questions];
  [questions[from], questions[to]] = [questions[to], questions[from]];
  return { ...draft, questions };
}

export function updateQuestion(draft: QuizDraft, key: string, patch: Partial<Question>): QuizDraft {
  return mapQuestion(draft, key, (q) => ({ ...q, ...patch }));
}

export function addOption(draft: QuizDraft, key: string): QuizDraft {
  return mapQuestion(draft, key, (q) =>
    q.options.length >= MAX_OPTIONS ? q : { ...q, options: [...q.options, ''] },
  );
}

export function removeOption(draft: QuizDraft, key: string, optionIndex: number): QuizDraft {
  return mapQuestion(draft, key, (q) => {
    if (q.options.length <= MIN_OPTIONS || optionIndex < 0 || optionIndex >= q.options.length) return q;

    // The correct answer must stay on the same text: options after the removed one shift up by one.
    let correctIndex = q.correctIndex;
    if (optionIndex < correctIndex) correctIndex -= 1;
    else if (optionIndex === correctIndex) correctIndex = 0;

    return { ...q, options: q.options.filter((_, i) => i !== optionIndex), correctIndex };
  });
}
