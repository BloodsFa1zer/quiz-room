import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@quiz/shared';

/**
 * The only socket of the app. It is created once at module level, not inside a component:
 * React StrictMode runs effects twice in dev and would otherwise open two connections.
 * No address is passed, so it connects to the page's own origin (in dev — through the Vite proxy).
 */
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();
