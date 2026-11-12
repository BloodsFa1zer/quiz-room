import {
  LEADERBOARD_SIZE,
  type HostState,
  type LeaderboardEntry,
  type PlayerInfo,
  type PlayerState,
  type QuestionPublic,
} from '@quiz/shared';

// Ready-made snapshots for the /dev gallery: one per screen state, shaped exactly like the server
// sends them (phase table in docs/00-common.md §6.3). `states.test.ts` checks every one of them.

/** One player of a fixture: name, total score, points for the last revealed question. */
type Row = [name: string, score: number, lastPoints: number];

// Any fixed moment: for the `question` phase the gallery replaces `serverNow` and `endsAt` anyway.
const NOW = 1_800_000_000_000;
const BASE = { pin: '123456', quizTitle: 'Столиці світу', questionCount: 10, serverNow: NOW };

const Q4: QuestionPublic = {
  text: 'Яке місто є столицею Австралії?',
  options: ['Сідней', 'Канберра', 'Мельбурн', 'Перт'],
  timeLimitSec: 20,
};
const Q2: QuestionPublic = {
  text: 'Київ стоїть на річці Дніпро?',
  options: ['Так', 'Ні'],
  timeLimitSec: 10,
};
const Q3: QuestionPublic = {
  text: 'Яке місто є столицею Канади?',
  options: ['Торонто', 'Оттава', 'Ванкувер'],
  timeLimitSec: 20,
};
// The longest texts the contract allows: 200 characters in the question, 80 in every option.
const Q_LONG: QuestionPublic = {
  text: 'Яке з наведених нижче міст є столицею держави, що лежить відразу на двох континентах, омивається чотирма морями та контролює протоки Босфор і Дарданелли, які зʼєднують Чорне море із Середземним морем?',
  options: [
    'Стамбул — найбільше місто держави, давній Константинополь, обабіч протоки Босфор',
    'Анкара — місто в центрі Анатолії, що стало столицею у 1923 році замість Стамбула',
    'Ізмір — третє за кількістю жителів місто та великий порт на Егейському узбережжі',
    'Анталія — відоме курортне місто на півдні країни, на узбережжі Середземного моря',
  ],
  timeLimitSec: 30,
};

/**
 * The game shown by the `question-*`, `reveal-*` and `leaderboard` fixtures, caught at question 2:
 * name, score after question 1, points for question 2. Nine players answer question 2 correctly.
 */
const GAME: Row[] = [
  ['Оля', 910, 870],
  ['Тарас', 0, 940],
  ['Марічка', 780, 0],
  ['Богдан', 650, 720],
  ['Соломія', 0, 0],
  ['Андрій', 990, 610],
  ['Катерина', 840, 0],
  ['Назар', 560, 0],
  ['Іванка', 0, 980],
  ['Остап', 720, 0],
  ['Олександра-Марія', 880, 850],
  ['Максим', 0, 0],
  ['Юля', 600, 0],
  ['Роман', 950, 560],
  ['Анна', 0, 0],
  ['Денис', 810, 0],
  ['Христина', 530, 790],
  ['Віталій', 0, 0],
  ['Леся', 690, 0],
  ['Павло', 760, 650],
];
// Scores change only at reveal, so during question 2 everyone still has the points of question 1.
const BEFORE_REVEAL: Row[] = GAME.map(([name, score]) => [name, score, score]);
const AFTER_REVEAL: Row[] = GAME.map(([name, score, points]) => [name, score + points, points]);
const NOBODY_ANSWERED: Row[] = GAME.map(([name, score]) => [name, score, 0]);

const FINAL: Row[] = [
  ['Оля', 7420, 870],
  ['Тарас', 5130, 0],
  ['Марічка', 6890, 910],
  ['Богдан', 4360, 640],
  ['Соломія', 2150, 0],
  ['Андрій', 8240, 980],
  ['Катерина', 5980, 0],
  ['Назар', 3470, 720],
  ['Іванка', 6310, 0],
  ['Остап', 1280, 0],
  ['Олександра-Марія', 7750, 850],
  ['Максим', 640, 0],
];

/** Builds `players` (join order) and `leaderboard` (sorted, with ranks) the way the server does. */
function roster(rows: Row[], offline: number[] = []): Pick<HostState, 'players' | 'leaderboard'> {
  const players: PlayerInfo[] = rows.map(([name, score], i) => ({
    id: `p${i + 1}`,
    name,
    score,
    connected: !offline.includes(i),
  }));
  const leaderboard: LeaderboardEntry[] = rows
    .map(([name, score, lastPoints], i) => ({ playerId: `p${i + 1}`, name, score, lastPoints, rank: 0 }))
    // Array.prototype.sort is stable: players with equal scores keep their join order.
    .sort((a, b) => b.score - a.score)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
  return { players, leaderboard };
}

function lobby(rows: Row[], offline: number[] = []): HostState {
  return {
    ...BASE,
    phase: 'lobby',
    questionIndex: -1,
    question: null,
    endsAt: null,
    correctIndex: null,
    answeredCount: 0,
    answerCounts: null,
    ...roster(rows, offline),
  };
}

function asking(question: QuestionPublic, answeredCount: number): HostState {
  return {
    ...BASE,
    phase: 'question',
    questionIndex: 1,
    question,
    endsAt: NOW + question.timeLimitSec * 1000,
    correctIndex: null,
    answeredCount,
    answerCounts: null,
    ...roster(BEFORE_REVEAL),
  };
}

/** `reveal` and `leaderboard` carry the same data: the answer to Q4, the counts and the new scores. */
function revealed(phase: 'reveal' | 'leaderboard', rows: Row[], answerCounts: number[]): HostState {
  return {
    ...BASE,
    phase,
    questionIndex: 1,
    question: Q4,
    endsAt: null,
    correctIndex: 1,
    answeredCount: answerCounts.reduce((sum, count) => sum + count, 0),
    answerCounts,
    ...roster(rows),
  };
}

function finished(rows: Row[]): HostState {
  return {
    ...BASE,
    phase: 'finished',
    questionIndex: BASE.questionCount - 1,
    question: null,
    endsAt: null,
    correctIndex: null,
    answeredCount: 0,
    answerCounts: null,
    ...roster(rows),
  };
}

export const hostFixtures: Record<string, HostState> = {
  'lobby-empty': lobby([]),
  'lobby-few': lobby(
    [
      ['Оля', 0, 0],
      ['Тарас', 0, 0],
      ['Марічка', 0, 0],
    ],
    [1],
  ),
  'lobby-full': lobby(
    Array.from({ length: 40 }, (_, i): Row => [`Гравець-Квізу-${String(i + 1).padStart(2, '0')}`, 0, 0]),
  ),
  'question-4': asking(Q4, 12),
  'question-2': asking(Q2, 7),
  'question-3': asking(Q3, 19),
  'question-long': asking(Q_LONG, 0),
  'reveal-4': revealed('reveal', AFTER_REVEAL, [3, 9, 2, 6]),
  'reveal-none': revealed('reveal', NOBODY_ANSWERED, [0, 0, 0, 0]),
  leaderboard: revealed('leaderboard', AFTER_REVEAL.slice(0, 12), [2, 6, 1, 3]),
  'finished-many': finished(FINAL),
  'finished-two': finished([
    ['Оля', 4200, 900],
    ['Тарас', 3650, 0],
  ]),
};

/**
 * The snapshot one player of `room` gets. The server builds it from the same room as the host
 * snapshot, so here `me`, `top` and `lastResult` are taken from the room's leaderboard too.
 * `myAnswer` is not part of the host snapshot, so the fixture names it.
 */
function seenBy(room: HostState, name: string, myAnswer: number | null = null): PlayerState {
  const { players, answeredCount, answerCounts, leaderboard, ...common } = room;
  const entry = leaderboard.find((row) => row.name === name);
  if (entry === undefined) throw new Error(`Fixture: no player "${name}" in the room`);
  const isRevealed = room.phase === 'reveal' || room.phase === 'leaderboard';

  return {
    ...common,
    me: { id: entry.playerId, name, score: entry.score, rank: entry.rank },
    playerCount: players.length,
    myAnswer,
    lastResult: isRevealed ? { correct: myAnswer === room.correctIndex, points: entry.lastPoints } : null,
    top: leaderboard.slice(0, LEADERBOARD_SIZE),
  };
}

// The host `leaderboard` fixture has 12 players; the 14th place needs the whole 20-player game.
const LEADERBOARD_ALL = revealed('leaderboard', AFTER_REVEAL, [3, 9, 2, 6]);

/** The same games as on the host screens, seen by one of their players. Q4: the correct option is B. */
export const playerFixtures: Record<string, PlayerState> = {
  lobby: seenBy(hostFixtures['lobby-few'], 'Марічка'),
  // The longest name the contract allows, so the header is checked at its widest.
  'question-4': seenBy(hostFixtures['question-4'], 'Олександра-Марія'),
  'question-2': seenBy(hostFixtures['question-2'], 'Олександра-Марія'),
  'question-3': seenBy(hostFixtures['question-3'], 'Олександра-Марія'),
  'question-long': seenBy(hostFixtures['question-long'], 'Олександра-Марія'),
  answered: seenBy(hostFixtures['question-4'], 'Марічка', 2),
  'reveal-correct': seenBy(hostFixtures['reveal-4'], 'Олександра-Марія', 1),
  'reveal-wrong': seenBy(hostFixtures['reveal-4'], 'Марічка', 2),
  'reveal-timeout': seenBy(hostFixtures['reveal-none'], 'Марічка'),
  'leaderboard-top': seenBy(LEADERBOARD_ALL, 'Оля', 1),
  'leaderboard-low': seenBy(LEADERBOARD_ALL, 'Леся', 0),
  'finished-winner': seenBy(hostFixtures['finished-many'], 'Андрій'),
  'finished-low': seenBy(hostFixtures['finished-many'], 'Назар'),
};
