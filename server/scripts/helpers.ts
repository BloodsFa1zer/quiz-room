import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientToServerEvents, ErrorCode, ServerToClientEvents } from '@quiz/shared';

// Shared by smoke.ts and bots.ts: connecting real Socket.IO clients and waiting for snapshots.

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** How long a script waits for an ack before treating the request as failed. */
export const ACK_TIMEOUT_MS = 3000;

/** The latest payload of every event, per socket, so a snapshot that already arrived is never missed. */
const latestByEvent = new WeakMap<Socket, Map<string, unknown>>();

/** Typed client; resolves once connected. */
export function connect(url: string, options: { reconnection?: boolean } = {}): Promise<ClientSocket> {
  return open(url, options);
}

/** Untyped client, for sending deliberately broken payloads. */
export function connectRaw(url: string): Promise<Socket> {
  return open(url, {});
}

function open(url: string, options: { reconnection?: boolean }): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: options.reconnection ?? false,
    });
    const latest = new Map<string, unknown>();
    latestByEvent.set(socket, latest);
    socket.onAny((event: string, payload: unknown) => latest.set(event, payload));
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => {
      socket.close();
      reject(new Error(`Cannot connect to ${url}: ${err.message}`));
    });
  });
}

/**
 * Resolves with the first snapshot of `event` that satisfies the predicate —
 * the latest one already received, or a future one. Rejects after `timeoutMs`.
 */
export function waitFor<T>(
  socket: Socket,
  event: keyof ServerToClientEvents,
  predicate: (state: T) => boolean,
  timeoutMs = ACK_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const received = latestByEvent.get(socket);
    if (received?.has(event) && predicate(received.get(event) as T)) {
      resolve(received.get(event) as T);
      return;
    }
    const listener = (name: string, payload: unknown) => {
      if (name !== event || !predicate(payload as T)) return;
      clearTimeout(timer);
      socket.offAny(listener);
      resolve(payload as T);
    };
    const timer = setTimeout(() => {
      socket.offAny(listener);
      reject(new Error(`timed out after ${timeoutMs} ms waiting for ${event}`));
    }, timeoutMs);
    socket.onAny(listener);
  });
}

export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Asserts that an ack is the given error. */
export function expectError(res: Ack, code: ErrorCode): void {
  check(!res.ok && res.error === code, `expected ${code}, got ${JSON.stringify(res)}`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
