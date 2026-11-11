import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Ack, HostState, PlayerState } from '@quiz/shared';
import { createApp, type AppOptions } from '../src/app';
import {
  ACK_TIMEOUT_MS,
  ask,
  check,
  connect,
  connectRaw,
  expectError,
  sleep,
  waitFor,
  type ClientSocket,
} from './helpers';

// Self-contained end-to-end run: starts the real server on a free port and plays through real sockets.
// Usage: npm run smoke. The last line of a successful run is `SMOKE OK`.

const TOTAL_TIMEOUT_MS = 30_000;
const tempDir = mkdtempSync(join(tmpdir(), 'quiz-smoke-'));
const servers: TestServer[] = [];

type TestServer = ReturnType<typeof createApp> & { url: string };
type Joined = { socket: ClientSocket; playerId: string };

async function startServer(options: AppOptions = {}): Promise<TestServer> {
  const app = createApp({ dataFile: join(tempDir, 'quizzes.json'), ...options });
  await new Promise<void>((resolve) => app.httpServer.listen(0, resolve));
  const { port } = app.httpServer.address() as AddressInfo;
  const server = { ...app, url: `http://localhost:${port}` };
  servers.push(server);
  return server;
}

async function step(name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (err) {
    throw new Error(`${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
  console.log(`✓ ${name}`);
}

function randomId(): string {
  return 'smoke-' + Math.random().toString(36).slice(2, 10);
}

async function joinAs(url: string, pin: string, name: string, playerId = randomId()): Promise<Joined> {
  const socket = await connect(url);
  const res = await ask(socket).emitWithAck('player:join', { pin, name, playerId });
  check(res.ok, `${name} could not join: ${JSON.stringify(res)}`);
  return { socket, playerId };
}

function isConnected(state: HostState, name: string): boolean | undefined {
  return state.players.find((p) => p.name === name)?.connected;
}

async function lobbyScenario(server: TestServer): Promise<void> {
  const { url, store } = server;
  const host = await connect(url);
  const players: Record<string, Joined> = {};
  let pin = '';

  await step('1. host:create з неіснуючим quizId → QUIZ_NOT_FOUND', async () => {
    expectError(await ask(host).emitWithAck('host:create', { quizId: 'nope' }), 'QUIZ_NOT_FOUND');
  });

  await step('2. host:create → PIN із 6 цифр, лобі без гравців', async () => {
    const res = await ask(host).emitWithAck('host:create', { quizId: store.list()[0].id });
    check(res.ok, JSON.stringify(res));
    pin = res.pin;
    check(/^[1-9]\d{5}$/.test(pin), `bad PIN ${pin}`);
    const state = await waitFor<HostState>(host, 'host:state', (s) => s.pin === pin);
    check(state.phase === 'lobby' && state.players.length === 0, `unexpected state ${JSON.stringify(state)}`);
  });

  await step('3. Оля, Тарас, Ірина заходять; ведучий бачить їх у порядку входу', async () => {
    for (const name of ['Оля', 'Тарас', 'Ірина']) {
      players[name] = await joinAs(url, pin, name);
      await waitFor<PlayerState>(players[name].socket, 'player:state', (s) => s.me.name === name);
    }
    await waitFor<HostState>(host, 'host:state', (s) => s.players.map((p) => p.name).join() === 'Оля,Тарас,Ірина');
    for (const { socket } of Object.values(players)) {
      await waitFor<PlayerState>(socket, 'player:state', (s) => s.playerCount === 3);
    }
  });

  await step('4. «оля» з іншим playerId → NAME_TAKEN', async () => {
    const socket = await connect(url);
    const res = await ask(socket).emitWithAck('player:join', { pin, name: 'оля', playerId: randomId() });
    expectError(res, 'NAME_TAKEN');
    socket.close();
  });

  await step('5. PIN 000000 → ROOM_NOT_FOUND; імʼя з 17 символів → INVALID_NAME', async () => {
    const socket = await connect(url);
    const res1 = await ask(socket).emitWithAck('player:join', { pin: '000000', name: 'Петро', playerId: randomId() });
    expectError(res1, 'ROOM_NOT_FOUND');
    const res2 = await ask(socket).emitWithAck('player:join', { pin, name: 'а'.repeat(17), playerId: randomId() });
    expectError(res2, 'INVALID_NAME');
    socket.close();
  });

  await step('6. сокет Тараса закрився → connected: false, гравців 3', async () => {
    players['Тарас'].socket.close();
    await waitFor<HostState>(host, 'host:state', (s) => isConnected(s, 'Тарас') === false && s.players.length === 3);
  });

  await step('7. Тарас повертається з тим самим playerId → connected: true', async () => {
    players['Тарас'] = await joinAs(url, pin, 'Тарас', players['Тарас'].playerId);
    await waitFor<HostState>(host, 'host:state', (s) => isConnected(s, 'Тарас') === true && s.players.length === 3);
  });

  await step('8. Ірина виходить і перехоплює себе з новим playerId', async () => {
    const oldId = players['Ірина'].playerId;
    players['Ірина'].socket.close();
    await waitFor<HostState>(host, 'host:state', (s) => isConnected(s, 'Ірина') === false);
    const { socket } = await joinAs(url, pin, 'Ірина');
    const state = await waitFor<PlayerState>(socket, 'player:state', (s) => s.me.name === 'Ірина');
    check(state.me.id === oldId, `expected me.id ${oldId}, got ${state.me.id}`);
    await waitFor<HostState>(host, 'host:state', (s) => isConnected(s, 'Ірина') === true && s.players.length === 3);
    players['Ірина'] = { socket, playerId: oldId };
  });

  await step('9. другий сокет через host:join отримує такий самий host:state', async () => {
    const host2 = await connect(url);
    const res = await ask(host2).emitWithAck('host:join', { pin });
    check(res.ok, JSON.stringify(res));
    const second = await waitFor<HostState>(host2, 'host:state', (s) => s.pin === pin);
    const first = await waitFor<HostState>(host, 'host:state', (s) => s.serverNow === second.serverNow);
    check(JSON.stringify(first) === JSON.stringify(second), 'the two hosts got different snapshots');
    host2.close();
  });

  await step('10. player:join з payload null → BAD_REQUEST, сервер живий', async () => {
    const raw = await connectRaw(url);
    const res: Ack = await raw.timeout(ACK_TIMEOUT_MS).emitWithAck('player:join', null);
    expectError(res, 'BAD_REQUEST');
    raw.close();
    const next = await ask(host).emitWithAck('host:join', { pin });
    check(next.ok, `server did not answer after a bad payload: ${JSON.stringify(next)}`);
  });

  host.close();
  for (const { socket } of Object.values(players)) socket.close();
}

const isPhase = (phase: string, questionIndex: number) => (s: HostState | PlayerState) =>
  s.phase === phase && s.questionIndex === questionIndex;

async function gameScenario(server: TestServer): Promise<void> {
  const { url, store, rooms } = server;
  const quiz = store.create({
    title: 'Smoke',
    questions: [
      { text: 'Q1', options: ['A', 'B', 'C', 'D'], correctIndex: 2, timeLimitSec: 5 },
      { text: 'Q2', options: ['Так', 'Ні'], correctIndex: 0, timeLimitSec: 5 },
      { text: 'Q3', options: ['A', 'B', 'C'], correctIndex: 1, timeLimitSec: 5 },
    ],
  });
  // Every snapshot of the run, checked against the invariants of §6.3 in step 9.
  const snapshots: { who: string; state: HostState | PlayerState }[] = [];
  const record = (who: string, socket: ClientSocket) => {
    socket.on('host:state', (state) => snapshots.push({ who, state }));
    socket.on('player:state', (state) => snapshots.push({ who, state }));
  };
  const host = await connect(url);
  record('host', host);
  const created = await ask(host).emitWithAck('host:create', { quizId: quiz.id });
  check(created.ok, JSON.stringify(created));
  const { pin } = created;
  const next = async () => check((await ask(host).emitWithAck('host:next')).ok, 'host:next failed');
  const [fast, slow, wrong] = ['Андрій', 'Богдана', 'Віктор'];
  const p: Record<string, ClientSocket> = {};
  const answer = (name: string, optionIndex: number) => ask(p[name]).emitWithAck('player:answer', { optionIndex });
  const playerState = (name: string, predicate: (s: PlayerState) => boolean, timeoutMs?: number) =>
    waitFor<PlayerState>(p[name], 'player:state', predicate, timeoutMs);

  await step('1. host:next у кімнаті без гравців → NO_PLAYERS', async () => {
    expectError(await ask(host).emitWithAck('host:next'), 'NO_PLAYERS');
  });

  await step('2. гравці зайшли, host:next → питання 0 у всіх, endsAt − serverNow ≈ 5 с, correctIndex: null', async () => {
    for (const name of [fast, slow, wrong]) {
      p[name] = (await joinAs(url, pin, name)).socket;
      record(name, p[name]);
    }
    await waitFor<HostState>(host, 'host:state', (s) => s.players.length === 3);
    await next();
    const states: (HostState | PlayerState)[] = [await waitFor<HostState>(host, 'host:state', isPhase('question', 0))];
    for (const name of [fast, slow, wrong]) states.push(await playerState(name, isPhase('question', 0)));
    for (const s of states) {
      const left = (s.endsAt ?? 0) - s.serverNow;
      check(left >= 4800 && left <= 5000, `endsAt − serverNow = ${left}`);
      check(s.correctIndex === null, 'correctIndex leaked during question');
    }
  });

  await step('3. INVALID_OPTION; усі відповіли → reveal < 500 мс без таймера; повтор → NOT_ACCEPTING_ANSWERS', async () => {
    expectError(await answer(fast, 9), 'INVALID_OPTION');
    check((await answer(fast, 2)).ok, 'fast answer failed');
    check((await answer(wrong, 0)).ok, 'wrong answer failed');
    await sleep(1000);
    const lastAnswerAt = Date.now();
    check((await answer(slow, 2)).ok, 'slow answer failed');
    await waitFor<HostState>(host, 'host:state', isPhase('reveal', 0));
    const delay = Date.now() - lastAnswerAt;
    check(delay < 500, `reveal came ${delay} ms after the last answer`);
    expectError(await answer(fast, 2), 'NOT_ACCEPTING_ANSWERS');
  });

  await step('4. reveal: правильна відповідь, розподіл, бали за швидкість', async () => {
    const hostState = await waitFor<HostState>(host, 'host:state', isPhase('reveal', 0));
    check(hostState.correctIndex === 2, `correctIndex ${hostState.correctIndex}`);
    const total = (hostState.answerCounts ?? []).reduce((a, b) => a + b, 0);
    check(total === 3, `answerCounts sum ${total}`);
    const [f, s, w] = await Promise.all([fast, slow, wrong].map((name) => playerState(name, isPhase('reveal', 0))));
    check(f.lastResult?.correct && s.lastResult?.correct, 'correct answers not marked correct');
    check((f.lastResult?.points ?? 0) > (s.lastResult?.points ?? 0), 'the faster answer did not get more points');
    check(JSON.stringify(w.lastResult) === '{"correct":false,"points":0}', `wrong: ${JSON.stringify(w.lastResult)}`);
    for (const state of [f, s, w]) check(state.me.score === state.lastResult?.points, 'me.score ≠ lastResult.points');
  });

  await step('5. host:next → leaderboard за балами → host:next → питання 1', async () => {
    await next();
    const board = (await waitFor<HostState>(host, 'host:state', isPhase('leaderboard', 0))).leaderboard;
    check(board.map((e) => e.name).join() === [fast, slow, wrong].join(), `order ${board.map((e) => e.name)}`);
    check(board.every((e, i) => e.rank === i + 1 && (i === 0 || board[i - 1].score >= e.score)), 'bad ranks');
    await next();
    await waitFor<HostState>(host, 'host:state', isPhase('question', 1));
  });

  await step('6. ALREADY_ANSWERED; host:next завершує питання достроково; без відповіді — 0 балів', async () => {
    check((await answer(slow, 0)).ok, 'answer failed');
    expectError(await answer(slow, 1), 'ALREADY_ANSWERED');
    await next();
    await waitFor<HostState>(host, 'host:state', isPhase('reveal', 1));
    for (const name of [fast, wrong]) {
      const s = await playerState(name, isPhase('reveal', 1));
      check(s.myAnswer === null && s.lastResult?.points === 0, `${name}: ${JSON.stringify(s.lastResult)}`);
    }
  });

  await step('7. питання 2 без відповідей → reveal за таймером через 4,5…6,5 с', async () => {
    await next();
    await next();
    const started = await waitFor<HostState>(host, 'host:state', isPhase('question', 2));
    const revealed = await waitFor<HostState>(host, 'host:state', isPhase('reveal', 2), 7000);
    const took = revealed.serverNow - started.serverNow;
    check(took >= 4500 && took <= 6500, `reveal came after ${took} ms`);
  });

  await step('8. host:next → finished без leaderboard; бали гравців = таблиця ведучого; далі GAME_FINISHED', async () => {
    await next();
    const final = await waitFor<HostState>(host, 'host:state', (s) => s.phase === 'finished');
    check(final.question === null, 'question is not null in finished');
    check(!snapshots.some(({ state }) => state.phase === 'leaderboard' && state.questionIndex === 2), 'extra leaderboard');
    for (const name of [fast, slow, wrong]) {
      const { me } = await playerState(name, (s) => s.phase === 'finished');
      const entry = final.leaderboard.find((e) => e.playerId === me.id);
      check(entry?.score === me.score && entry.rank === me.rank, `${name}: ${JSON.stringify(me)} vs ${JSON.stringify(entry)}`);
    }
    expectError(await ask(host).emitWithAck('host:next'), 'GAME_FINISHED');
    check(rooms.getRoom(pin)?.timer === null, 'room timer was not cleared after finished');
  });

  await step('9. жоден знімок у фазі question не видав відповідь і не змінив бали', async () => {
    const during = snapshots.filter(({ state }) => state.phase === 'question');
    check(during.every(({ state }) => state.correctIndex === null), 'correctIndex leaked during question');
    for (const { who, state } of during) {
      if (!('me' in state)) continue;
      const same = during.filter((x) => x.who === who && x.state.questionIndex === state.questionIndex);
      check(same.every((x) => 'me' in x.state && x.state.me.score === state.me.score), `${who}: score changed in question`);
      check(state.lastResult === null, `${who}: lastResult during question`);
    }
  });

  host.close();
  for (const socket of Object.values(p)) socket.close();
}

async function main(): Promise<void> {
  console.log('— Лобі');
  await lobbyScenario(await startServer());
  console.log('— Гра');
  await gameScenario(await startServer());
}

function finish(error?: unknown): void {
  for (const server of servers) server.io.close();
  rmSync(tempDir, { recursive: true, force: true });
  if (error) {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
  console.log('SMOKE OK');
  process.exit(0);
}

setTimeout(() => finish(new Error(`smoke run took longer than ${TOTAL_TIMEOUT_MS / 1000} s`)), TOTAL_TIMEOUT_MS);
main().then(() => finish(), finish);
