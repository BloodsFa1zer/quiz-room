import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Ack, HostState, PlayerState } from '@quiz/shared';
import { createApp, type AppOptions } from '../src/app';
import { ACK_TIMEOUT_MS, check, connect, connectRaw, expectError, waitFor, type ClientSocket } from './helpers';

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
  const res = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('player:join', { pin, name, playerId });
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
    expectError(await host.timeout(ACK_TIMEOUT_MS).emitWithAck('host:create', { quizId: 'nope' }), 'QUIZ_NOT_FOUND');
  });

  await step('2. host:create → PIN із 6 цифр, лобі без гравців', async () => {
    const res = await host.timeout(ACK_TIMEOUT_MS).emitWithAck('host:create', { quizId: store.list()[0].id });
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
    const res = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('player:join', { pin, name: 'оля', playerId: randomId() });
    expectError(res, 'NAME_TAKEN');
    socket.close();
  });

  await step('5. PIN 000000 → ROOM_NOT_FOUND; імʼя з 17 символів → INVALID_NAME', async () => {
    const socket = await connect(url);
    const emit = socket.timeout(ACK_TIMEOUT_MS);
    expectError(await emit.emitWithAck('player:join', { pin: '000000', name: 'Петро', playerId: randomId() }), 'ROOM_NOT_FOUND');
    expectError(await emit.emitWithAck('player:join', { pin, name: 'а'.repeat(17), playerId: randomId() }), 'INVALID_NAME');
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
    const res = await host2.timeout(ACK_TIMEOUT_MS).emitWithAck('host:join', { pin });
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
    const next = await host.timeout(ACK_TIMEOUT_MS).emitWithAck('host:join', { pin });
    check(next.ok, `server did not answer after a bad payload: ${JSON.stringify(next)}`);
  });

  host.close();
  for (const { socket } of Object.values(players)) socket.close();
}

async function main(): Promise<void> {
  console.log('— Лобі');
  await lobbyScenario(await startServer());
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
