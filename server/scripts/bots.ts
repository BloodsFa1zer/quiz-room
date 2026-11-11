import { parseArgs } from 'node:util';
import {
  CLIENT_PORT,
  ERROR_MESSAGES,
  LEADERBOARD_SIZE,
  type ErrorCode,
  type HostState,
  type PlayerState,
  type QuizSummary,
  type ServerConfig,
} from '@quiz/shared';
import { ask, connect, sleep, waitFor, type ClientSocket } from './helpers';

// Demo bots: fill a room with players and, with --autohost, run the whole game by themselves.
// They connect to an ALREADY RUNNING server: npm run bots -- --autohost

const HELP = `Боти для QuizRoom. Сервер має бути вже запущений (npm run dev або npm start).

  npm run bots -- --pin <PIN> [прапорці]    боти заходять у наявну кімнату
  npm run bots -- --autohost [прапорці]     скрипт сам створює кімнату й веде гру

  --url <адреса>     адреса сервера (за замовчуванням http://localhost:3001)
  --pin <PIN>        зайти ботами в наявну кімнату
  --autohost         самому створити кімнату й вести гру
  --quiz <id>        який квіз запускати, лише з --autohost (за замовчуванням перший зі списку)
  --count <n>        кількість ботів (за замовчуванням 10; з --autohost можна 0)
  --skip <0..1>      імовірність, що бот не відповість на питання (за замовчуванням 0.1)
  --lobby-wait <с>   скільки авто-ведучий чекає в лобі перед стартом (за замовчуванням 15)
  --step-delay <с>   пауза авто-ведучого перед кожним «Далі» (за замовчуванням 4)
  --help             показати цю підказку`;

const NAMES = [
  'Оля', 'Тарас', 'Ірина', 'Андрій', 'Богдана', 'Віктор', 'Галина', 'Дмитро', 'Олена', 'Євген',
  'Жанна', 'Зоряна', 'Іван', 'Катерина', 'Леся', 'Максим', 'Наталя', 'Остап', 'Поліна', 'Роман',
  'Соломія', 'Тетяна', 'Устим', 'Христина', 'Юрій', 'Яна', 'Василь', 'Марта', 'Назар', 'Софія',
  'Богдан', 'Злата', 'Петро', 'Ліна', 'Мирослав', 'Дарина', 'Олекса', 'Вероніка', 'Арсен', 'Ганна',
  'Степан', 'Уляна',
];

const options = readOptions();
const sockets: ClientSocket[] = [];
let exiting = false;
let botAnswers = 0;

function readOptions() {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        url: { type: 'string', default: 'http://localhost:3001' },
        pin: { type: 'string' },
        autohost: { type: 'boolean', default: false },
        quiz: { type: 'string' },
        count: { type: 'string', default: '10' },
        skip: { type: 'string', default: '0.1' },
        'lobby-wait': { type: 'string', default: '15' },
        'step-delay': { type: 'string', default: '4' },
        help: { type: 'boolean', default: false },
      },
    }));
  } catch (err) {
    return usage(err instanceof Error ? err.message : String(err));
  }
  if (values.help) {
    console.log(HELP);
    process.exit(0);
  }
  if (Boolean(values.pin) === values.autohost) return usage('Вкажіть рівно одне з --pin або --autohost.');
  const count = Number(values.count);
  const skip = Number(values.skip);
  const lobbyWait = Number(values['lobby-wait']);
  const stepDelay = Number(values['step-delay']);
  if (!Number.isInteger(count) || count < (values.autohost ? 0 : 1)) return usage('Некоректне значення --count.');
  if (!(skip >= 0 && skip <= 1)) return usage('--skip має бути числом від 0 до 1.');
  if (!(lobbyWait >= 0) || !(stepDelay >= 0)) return usage('Некоректне значення --lobby-wait або --step-delay.');
  return { url: values.url, pin: values.pin, autohost: values.autohost, quiz: values.quiz, count, skip, lobbyWait, stepDelay };
}

function usage(problem: string): never {
  console.log(`${problem}\n\n${HELP}`);
  process.exit(1);
}

/** Disconnects every socket of this process and exits. */
function shutdown(code: number, message?: string): never {
  exiting = true;
  if (message) (code === 0 ? console.log : console.error)(message);
  for (const socket of sockets) socket.close();
  process.exit(code);
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(options.url + path);
  if (!res.ok) shutdown(1, `Сервер відповів ${res.status} на ${path}`);
  return (await res.json()) as T;
}

/** Waits up to 5 s for the server to answer, so a stopped server gives a clear message instead of a stack trace. */
async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 5000;
  for (;;) {
    try {
      if ((await fetch(options.url + '/api/health')).ok) return;
    } catch {
      // Not reachable yet.
    }
    if (Date.now() >= deadline) shutdown(1, `Сервер ${options.url} недоступний. Запустіть його: npm run dev:server`);
    await sleep(500);
  }
}

async function open(): Promise<ClientSocket> {
  const socket = await connect(options.url);
  sockets.push(socket);
  socket.on('room:closed', () => shutdown(0, 'Кімнату закрито на сервері.'));
  socket.on('disconnect', (reason) => {
    if (!exiting) shutdown(1, `Звʼязок із сервером втрачено (${reason}).`);
  });
  return socket;
}

function fail(code: ErrorCode): never {
  return shutdown(1, ERROR_MESSAGES[code]);
}

/** One bot: joins (trying "Оля 2", "Оля 3"… if the name is taken) and answers randomly. */
async function startBot(pin: string, baseName: string): Promise<{ socket: ClientSocket; name: string }> {
  const socket = await open();
  const playerId = 'bot-' + Math.random().toString(36).slice(2, 10);
  let name = '';
  for (let attempt = 1; attempt <= 5 && !name; attempt++) {
    const candidate = attempt === 1 ? baseName : `${baseName} ${attempt}`;
    const res = await ask(socket).emitWithAck('player:join', { pin, name: candidate, playerId });
    if (res.ok) name = candidate;
    else if (res.error !== 'NAME_TAKEN') fail(res.error);
  }
  if (!name) fail('NAME_TAKEN');

  let lastQuestion = -1;
  socket.on('player:state', ({ phase, questionIndex, question }) => {
    if (phase !== 'question' || !question || questionIndex === lastQuestion) return;
    lastQuestion = questionIndex;
    if (Math.random() < options.skip) return;
    // The bot does not know the right answer: a random option after 1 s … 70% of the time limit.
    const latestMs = Math.max(1000, question.timeLimitSec * 1000 * 0.7);
    setTimeout(() => {
      const optionIndex = Math.floor(Math.random() * question.options.length);
      socket.emit('player:answer', { optionIndex }, (res) => {
        if (res.ok) botAnswers += 1;
      });
    }, 1000 + Math.random() * (latestMs - 1000));
  });
  return { socket, name };
}

/** Prints one line per game event (question, reveal, final) — never one per snapshot. */
function createReporter(botCount: number) {
  let shownQuestion = -1;
  let shownReveal = -1;
  let questionStartedAt = 0;
  return (state: HostState | PlayerState): void => {
    const { phase, questionIndex, question } = state;
    if (phase === 'question' && question && state.endsAt && questionIndex !== shownQuestion) {
      shownQuestion = questionIndex;
      questionStartedAt = state.endsAt - question.timeLimitSec * 1000;
      botAnswers = 0;
      console.log(`Питання ${questionIndex + 1}/${state.questionCount}: ${question.text}`);
    }
    if (phase === 'reveal' && questionIndex !== shownReveal && questionIndex === shownQuestion) {
      shownReveal = questionIndex;
      const answered =
        'players' in state ? `відповіли ${state.answeredCount}/${state.players.length}` : `боти відповіли ${botAnswers}/${botCount}`;
      const seconds = ((state.serverNow - questionStartedAt) / 1000).toFixed(1);
      console.log(`  reveal: ${answered}, через ${seconds} с з ${question?.timeLimitSec}`);
    }
    if (phase === 'finished') {
      const top = 'players' in state ? state.leaderboard.slice(0, LEADERBOARD_SIZE) : state.top;
      console.log('Фінал, топ-5:');
      for (const entry of top) console.log(`  ${entry.rank}. ${entry.name} — ${entry.score}`);
      shutdown(0);
    }
  };
}

/** Auto-host: creates the room, waits in the lobby, then presses «Далі» in every phase except `question`. */
async function startHost(): Promise<{ host: ClientSocket; pin: string }> {
  const quizId = options.quiz ?? (await getJson<QuizSummary[]>('/api/quizzes'))[0]?.id;
  if (!quizId) shutdown(1, 'На сервері немає жодного квізу.');
  const host = await open();
  const res = await ask(host).emitWithAck('host:create', { quizId });
  if (!res.ok) fail(res.error);
  const { lanIp } = await getJson<ServerConfig>('/api/config');
  console.log(`PIN: ${res.pin}`);
  console.log(`Вхід для гравців (dev-режим): http://${lanIp ?? 'localhost'}:${CLIENT_PORT}/?pin=${res.pin}`);
  return { host, pin: res.pin };
}

async function driveGame(host: ClientSocket, report: (state: HostState) => void): Promise<void> {
  let scheduled = '';
  const onState = (state: HostState) => {
    report(state);
    if (state.phase === 'question' || state.phase === 'finished') return;
    const key = `${state.phase}:${state.questionIndex}`;
    if (key === scheduled) return;
    scheduled = key;
    setTimeout(async () => {
      const res = await ask(host).emitWithAck('host:next');
      if (!res.ok && res.error === 'NO_PLAYERS') {
        console.log('Чекаю гравців…');
        scheduled = ''; // The next snapshot (someone joined) schedules «Далі» again.
      }
    }, options.stepDelay * 1000);
  };
  // Start from the snapshot that arrived while we were waiting in the lobby.
  onState(await waitFor<HostState>(host, 'host:state', () => true));
  host.on('host:state', onState);
}

async function main(): Promise<void> {
  process.on('SIGINT', () => shutdown(0, '\nЗупинено, боти відключені.'));
  await waitForServer();
  const hosted = options.autohost ? await startHost() : null;
  const pin = hosted?.pin ?? options.pin ?? '';

  const shuffled = [...NAMES].sort(() => Math.random() - 0.5);
  const bots = await Promise.all(
    Array.from({ length: options.count }, (_, i) => startBot(pin, shuffled[i % shuffled.length])),
  );
  if (bots.length > 0) console.log(`Боти в кімнаті ${pin} (${bots.length}): ${bots.map((b) => b.name).join(', ')}`);

  const report = createReporter(bots.length);
  if (hosted) {
    console.log(`Старт через ${options.lobbyWait} с…`);
    await sleep(options.lobbyWait * 1000);
    await driveGame(hosted.host, report);
  } else {
    bots[0].socket.on('player:state', report);
  }
}

main().catch((err) => shutdown(1, `Помилка: ${err instanceof Error ? err.message : String(err)}`));
