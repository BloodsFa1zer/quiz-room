# Етап 0 — Каркас монорепо і контракт

**Мета:** порожній, але робочий монорепозиторій: три пакети (`shared`, `server`, `client`), усі залежності встановлені, контракт на місці, `npm run dev` піднімає сервер і клієнт, клієнт бачить сервер через проксі. Після цього етапу A і B працюють паралельно й більше не чіпають кореневі файли.

**Виконує:** кодер A. **Перевіряє:** кодер B (`/quiz-stage 0 verify`).

**Залежить від:** нічого. Потрібні Node.js ≥ 22.12 і npm.

**Розмір:** S — код писати не треба. Усі файли нижче вже перевірені разом: чисте встановлення, typecheck, тести, збірка, dev-проксі REST і WebSocket (зокрема за LAN-адресою).

## Вимоги

1. **Не передруковуй файли вручну.** Кожен блок нижче позначений коментарем `<!-- file: шлях -->`. Виконай із кореня репозиторію команду, яка витягне всі блоки у файли без змін:

   ```bash
   node -e 'const fs=require("fs"),path=require("path");const md=fs.readFileSync("docs/01-stage-0.md","utf8");const re=/<!-- file: (.+?) -->\r?\n```[a-z]*\r?\n([\s\S]*?)\r?\n```/g;let m,n=0;while((m=re.exec(md))){fs.mkdirSync(path.dirname(m[1]),{recursive:true});fs.writeFileSync(m[1],m[2].replace(/\r\n/g,"\n")+"\n");console.log("wrote",m[1]);n++}console.log(n,"files")'
   ```

   Очікуваний вивід закінчується рядком `18 files`. У PowerShell одинарні лапки навколо скрипта не спрацюють — запускай у bash (Git Bash, WSL, macOS, Linux).
2. Виконай `npm install` у корені. Закоміть `package-lock.json`.
3. Створи `README.md` у корені: назва проєкту, один абзац «що це», вимоги (Node ≥ 22.12), команди `npm install` і `npm run dev`, адреси (`http://localhost:5173` — клієнт, `http://localhost:3001` — сервер), посилання на `docs/00-common.md`. До 30 рядків. Далі README веде кодер A (етап A5).
4. Нічого не «покращуй» у конфігах: версії, опції `tsconfig`, скрипти — саме такі, як тут.

## Поза межами етапу

Будь-яка логіка сервера чи клієнта, Socket.IO, роутинг, стилі. Заглушки `server/src/app.ts` і `client/src/App.tsx` потрібні лише для перевірки, що каркас живий: A розширює першу на A1, B замінює другу на B1.

## Acceptance criteria

- **0-AC1.** Усі 18 файлів із цього документа існують і створені командою з вимоги 1, без ручних правок.
- **0-AC2.** `npm install` завершується без помилок; `package-lock.json` є в репозиторії.
- **0-AC3.** `npm run typecheck` — код виходу 0.
- **0-AC4.** `npm test` — код виходу 0. Повідомлення «No test files found» для сервера і клієнта — це нормально: тестів ще немає.
- **0-AC5.** `npm run build` створює `client/dist/index.html`.
- **0-AC6.** При запущеному `npm run dev`: `curl -s http://localhost:3001/api/health` і `curl -s http://localhost:5173/api/health` обидва повертають `{"ok":true}`. Другий запит доводить, що працює проксі Vite.
- **0-AC7.** Контракт не змінено. Команда

  ```bash
  node -e 'console.log(require("crypto").createHash("sha256").update(require("fs").readFileSync("shared/src/index.ts")).digest("hex"))'
  ```

  друкує `25e8a6b6655612eddb7391536c14190c411918257e1e11e5987842b3a22b1615`.
- **0-AC8.** `README.md` існує і містить команди запуску.

## Перевірка

```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev          # у фоні або в окремому терміналі
curl -s http://localhost:3001/api/health
curl -s http://localhost:5173/api/health
```

## Ручна перевірка (людина)

- Відкрити `http://localhost:5173` на ноутбуці: видно «QuizRoom», «сервер на звʼязку ✅» і рядок про час за замовчуванням 20 с.
- Відкрити `http://<LAN-IP ноутбука>:5173` з телефона в тій самій мережі: видно те саме. Якщо не відкривається — див. граблі G2 і G3 у `docs/00-common.md`.

## Файли

### Корінь

<!-- file: package.json -->
```json
{
  "name": "quiz-room",
  "private": true,
  "workspaces": [
    "shared",
    "server",
    "client"
  ],
  "scripts": {
    "dev": "concurrently -n server,client -c blue,green \"npm run dev -w server\" \"npm run dev -w client\"",
    "dev:server": "npm run dev -w server",
    "dev:client": "npm run dev -w client",
    "typecheck": "npm run typecheck --workspaces",
    "test": "npm run test --workspaces --if-present",
    "smoke": "npm run smoke -w server",
    "bots": "npm run bots -w server --",
    "build": "npm run build -w client",
    "start": "npm run start -w server"
  },
  "devDependencies": {
    "concurrently": "^10.0.0",
    "typescript": "^7.0.0"
  }
}
```

<!-- file: tsconfig.base.json -->
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

<!-- file: .gitignore -->
```text
node_modules
dist
server/data
.DS_Store
*.log
```

<!-- file: .gitattributes -->
```text
* text=auto eol=lf
```

### shared — контракт

<!-- file: shared/package.json -->
```json
{
  "name": "@quiz/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit" }
}
```

<!-- file: shared/tsconfig.json -->
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "lib": ["ES2022"] },
  "include": ["src"]
}
```

Наступний файл і є контракт. Після етапу 0 він заморожений (правило R2).

<!-- file: shared/src/index.ts -->
```ts
/**
 * @quiz/shared — the single contract between server and client.
 *
 * FROZEN after Stage 0. Neither coder edits this file on their own:
 * any change goes through the "contract change" procedure (docs/00-common.md §9).
 * This file must stay a single file with no imports.
 */

// ───────────────────────── Constants ─────────────────────────

export const SERVER_PORT = 3001;
export const CLIENT_PORT = 5173;

export const PIN_LENGTH = 6;
export const MAX_PLAYERS = 50;
export const MAX_NAME_LENGTH = 16;

export const MAX_TITLE_LENGTH = 80;
export const MAX_QUESTION_LENGTH = 200;
export const MAX_OPTION_LENGTH = 80;
export const MAX_QUESTIONS = 50;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;

export const MIN_TIME_LIMIT_SEC = 5;
export const MAX_TIME_LIMIT_SEC = 120;
export const DEFAULT_TIME_LIMIT_SEC = 20;
export const TIME_LIMIT_CHOICES = [5, 10, 20, 30, 60, 90, 120] as const;

/** Points for an instant correct answer. */
export const MAX_POINTS = 1000;
/** Points for a correct answer given at the very last moment. */
export const MIN_POINTS = 500;

/** How many rows the "top" leaderboard shows. */
export const LEADERBOARD_SIZE = 5;

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

// ───────────────────────── Quiz (REST) ─────────────────────────

export interface Question {
  text: string;
  /** MIN_OPTIONS..MAX_OPTIONS non-empty strings. */
  options: string[];
  /** Index into `options`. */
  correctIndex: number;
  /** MIN_TIME_LIMIT_SEC..MAX_TIME_LIMIT_SEC, integer. */
  timeLimitSec: number;
}

export interface Quiz {
  id: string;
  title: string;
  questions: Question[];
  /** Epoch ms. */
  createdAt: number;
  /** Epoch ms. */
  updatedAt: number;
}

export interface QuizSummary {
  id: string;
  title: string;
  questionCount: number;
  updatedAt: number;
}

/** Body of POST /api/quizzes and PUT /api/quizzes/:id. */
export interface QuizInput {
  title: string;
  questions: Question[];
}

/** Body of every non-2xx REST response. */
export interface ApiError {
  error: string;
  details?: string[];
}

/** Response of GET /api/config. */
export interface ServerConfig {
  /** First non-internal IPv4 of the server machine, or null if there is none. */
  lanIp: string | null;
}

/**
 * Validates a quiz payload. Returns a list of human-readable (Ukrainian) errors;
 * an empty list means the payload is valid. Used by BOTH the editor and the server.
 */
export function validateQuizInput(input: unknown): string[] {
  if (typeof input !== 'object' || input === null) return ['Некоректні дані квізу'];
  const { title, questions } = input as Partial<QuizInput>;
  const errors: string[] = [];

  if (typeof title !== 'string' || title.trim() === '') {
    errors.push('Вкажіть назву квізу');
  } else if (title.trim().length > MAX_TITLE_LENGTH) {
    errors.push(`Назва квізу — не довше ${MAX_TITLE_LENGTH} символів`);
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push('Додайте хоча б одне питання');
    return errors;
  }
  if (questions.length > MAX_QUESTIONS) {
    errors.push(`У квізі може бути не більше ${MAX_QUESTIONS} питань`);
  }

  questions.forEach((q: unknown, i: number) => {
    const n = i + 1;
    if (typeof q !== 'object' || q === null) {
      errors.push(`Питання ${n}: некоректні дані`);
      return;
    }
    const { text, options, correctIndex, timeLimitSec } = q as Partial<Question>;

    if (typeof text !== 'string' || text.trim() === '') {
      errors.push(`Питання ${n}: введіть текст питання`);
    } else if (text.trim().length > MAX_QUESTION_LENGTH) {
      errors.push(`Питання ${n}: текст — не довше ${MAX_QUESTION_LENGTH} символів`);
    }

    if (!Array.isArray(options) || options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
      errors.push(`Питання ${n}: має бути від ${MIN_OPTIONS} до ${MAX_OPTIONS} варіантів відповіді`);
    } else {
      if (options.some((o) => typeof o !== 'string' || o.trim() === '')) {
        errors.push(`Питання ${n}: заповніть усі варіанти відповіді`);
      } else if (options.some((o) => o.trim().length > MAX_OPTION_LENGTH)) {
        errors.push(`Питання ${n}: варіант відповіді — не довше ${MAX_OPTION_LENGTH} символів`);
      }
      if (
        typeof correctIndex !== 'number' ||
        !Number.isInteger(correctIndex) ||
        correctIndex < 0 ||
        correctIndex >= options.length
      ) {
        errors.push(`Питання ${n}: позначте правильну відповідь`);
      }
    }

    if (
      typeof timeLimitSec !== 'number' ||
      !Number.isInteger(timeLimitSec) ||
      timeLimitSec < MIN_TIME_LIMIT_SEC ||
      timeLimitSec > MAX_TIME_LIMIT_SEC
    ) {
      errors.push(
        `Питання ${n}: час на відповідь — від ${MIN_TIME_LIMIT_SEC} до ${MAX_TIME_LIMIT_SEC} секунд`,
      );
    }
  });

  return errors;
}

/** A PIN is exactly PIN_LENGTH digits. */
export function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && pin.length === PIN_LENGTH && /^\d+$/.test(pin);
}

/** A player name is 1..MAX_NAME_LENGTH characters after trimming. */
export function isValidPlayerName(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= MAX_NAME_LENGTH;
}

// ───────────────────────── Game state (WebSocket) ─────────────────────────

/**
 * lobby → question → reveal → leaderboard → question → … → reveal → finished
 * (after the LAST question `reveal` goes straight to `finished`, skipping `leaderboard`)
 */
export type Phase = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'finished';

/** A question as clients see it: never contains the correct answer. */
export interface QuestionPublic {
  text: string;
  options: string[];
  timeLimitSec: number;
}

export interface PlayerInfo {
  id: string;
  name: string;
  score: number;
  /** false while the player's socket is disconnected. */
  connected: boolean;
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  score: number;
  /** 1-based position. Sorted by score desc, ties broken by join order. No shared ranks. */
  rank: number;
  /** Points earned for the most recently revealed question (0 before the first reveal). */
  lastPoints: number;
}

/** Fields common to the host and player snapshots. See the phase table in docs/00-common.md §6.3. */
interface RoomStateBase {
  pin: string;
  phase: Phase;
  quizTitle: string;
  /** 0-based index of the current question; -1 in `lobby`; last index in `finished`. */
  questionIndex: number;
  questionCount: number;
  /** Set in `question`, `reveal`, `leaderboard`; null in `lobby` and `finished`. */
  question: QuestionPublic | null;
  /** Server epoch ms when answering closes. Set only in `question`. */
  endsAt: number | null;
  /** Set only in `reveal` and `leaderboard`. NEVER sent during `question`. */
  correctIndex: number | null;
  /** Server epoch ms at the moment this snapshot was built (for clock-offset calculation). */
  serverNow: number;
}

/** Full snapshot for the host screen. Sent as `host:state` after every change. */
export interface HostState extends RoomStateBase {
  /** All players in join order (including disconnected ones). */
  players: PlayerInfo[];
  /** How many players have answered the current question (0 in `lobby` / `finished`). */
  answeredCount: number;
  /** Answers per option for the current question. Set only in `reveal` and `leaderboard`. */
  answerCounts: number[] | null;
  /** All players, sorted. Scores include the current question only from `reveal` on. */
  leaderboard: LeaderboardEntry[];
}

/** Personal snapshot for one player. Sent as `player:state` after every change. */
export interface PlayerState extends RoomStateBase {
  me: { id: string; name: string; score: number; rank: number };
  playerCount: number;
  /** Option this player picked for the current question, or null if not answered. */
  myAnswer: number | null;
  /** Result for the current question. Set only in `reveal` and `leaderboard`. */
  lastResult: { correct: boolean; points: number } | null;
  /** First LEADERBOARD_SIZE entries of the leaderboard. */
  top: LeaderboardEntry[];
}

// ───────────────────────── Socket.IO events ─────────────────────────

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'QUIZ_NOT_FOUND'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'GAME_FINISHED'
  | 'INVALID_NAME'
  | 'NAME_TAKEN'
  | 'NOT_IN_ROOM'
  | 'NO_PLAYERS'
  | 'NOT_ACCEPTING_ANSWERS'
  | 'ALREADY_ANSWERED'
  | 'INVALID_OPTION';

/** Ukrainian UI text for every error code. The client shows these as-is. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  BAD_REQUEST: 'Некоректний запит',
  QUIZ_NOT_FOUND: 'Квіз не знайдено',
  ROOM_NOT_FOUND: 'Гру з таким кодом не знайдено',
  ROOM_FULL: 'У кімнаті вже максимальна кількість гравців',
  GAME_FINISHED: 'Ця гра вже завершилась',
  INVALID_NAME: `Імʼя має містити від 1 до ${MAX_NAME_LENGTH} символів`,
  NAME_TAKEN: 'Це імʼя вже зайняте — обери інше',
  NOT_IN_ROOM: 'Ти не в кімнаті — приєднайся ще раз',
  NO_PLAYERS: 'Потрібен хоча б один гравець',
  NOT_ACCEPTING_ANSWERS: 'Відповіді зараз не приймаються',
  ALREADY_ANSWERED: 'Ти вже відповів на це питання',
  INVALID_OPTION: 'Такого варіанту відповіді немає',
};

/** Every client→server event is answered through its ack callback with this shape. */
export type Ack<T = unknown> = ({ ok: true } & T) | { ok: false; error: ErrorCode };

export interface ClientToServerEvents {
  /** Create a room for a quiz. The calling socket becomes the room's host. */
  'host:create': (payload: { quizId: string }, ack: (res: Ack<{ pin: string }>) => void) => void;
  /** Attach this socket to an existing room as host. Idempotent; used on page load and on reconnect. */
  'host:join': (payload: { pin: string }, ack: (res: Ack) => void) => void;
  /** Advance the game one step (see the transition table in docs/00-common.md §6.4). */
  'host:next': (ack: (res: Ack) => void) => void;
  /** Join a room as a player, or re-attach to an existing player. Idempotent. */
  'player:join': (
    payload: { pin: string; name: string; playerId: string },
    ack: (res: Ack) => void,
  ) => void;
  /** Answer the current question. One answer per question, only during `question`. */
  'player:answer': (payload: { optionIndex: number }, ack: (res: Ack) => void) => void;
}

export interface ServerToClientEvents {
  'host:state': (state: HostState) => void;
  'player:state': (state: PlayerState) => void;
  /** The room was deleted on the server (expired). Clients show a "game is over" screen. */
  'room:closed': () => void;
}
```

### server — заглушка

<!-- file: server/package.json -->
```json
{
  "name": "@quiz/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests",
    "smoke": "tsx scripts/smoke.ts",
    "bots": "tsx scripts/bots.ts"
  },
  "dependencies": {
    "@quiz/shared": "*",
    "express": "^5.0.0",
    "socket.io": "^4.8.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "socket.io-client": "^4.8.0",
    "tsx": "^4.19.0",
    "vitest": "^5.0.0"
  }
}
```

<!-- file: server/tsconfig.json -->
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "lib": ["ES2022"], "types": ["node"] },
  "include": ["src", "scripts"]
}
```

<!-- file: server/src/app.ts -->
```ts
import { createServer } from 'node:http';
import express from 'express';

/** Builds the HTTP app without starting to listen, so scripts and tests can run it on any port. */
export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  const httpServer = createServer(app);
  return { app, httpServer };
}
```

<!-- file: server/src/index.ts -->
```ts
import { SERVER_PORT } from '@quiz/shared';
import { createApp } from './app';

const { httpServer } = createApp();
const port = Number(process.env.PORT) || SERVER_PORT;

httpServer.listen(port, () => {
  console.log(`[server] http://localhost:${port}`);
});
```

### client — заглушка

<!-- file: client/package.json -->
```json
{
  "name": "@quiz/client",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    "@quiz/shared": "*",
    "qrcode.react": "^4.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "socket.io-client": "^4.8.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^6.0.0",
    "vite": "^8.0.0",
    "vitest": "^5.0.0"
  }
}
```

<!-- file: client/tsconfig.json -->
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

<!-- file: client/vite.config.ts -->
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { CLIENT_PORT, SERVER_PORT } from '@quiz/shared';

const target = `http://localhost:${SERVER_PORT}`;

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on 0.0.0.0 so phones on the same network can connect
    port: CLIENT_PORT,
    strictPort: true,
    allowedHosts: true, // allow tunnel hostnames (demo fallback)
    proxy: {
      '/api': target,
      '/socket.io': { target, ws: true },
    },
  },
});
```

<!-- file: client/index.html -->
```html
<!doctype html>
<html lang="uk">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>QuizRoom</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

<!-- file: client/src/vite-env.d.ts -->
```ts
/// <reference types="vite/client" />
```

<!-- file: client/src/main.tsx -->
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

<!-- file: client/src/App.tsx -->
```tsx
import { useEffect, useState } from 'react';
import { DEFAULT_TIME_LIMIT_SEC } from '@quiz/shared';

/** Stage 0 stub: proves that the Vite proxy and the shared package work. Replaced in stage B1. */
export function App() {
  const [health, setHealth] = useState('перевіряю…');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((body: { ok: boolean }) => setHealth(body.ok ? 'сервер на звʼязку ✅' : 'помилка ❌'))
      .catch(() => setHealth('сервер недоступний ❌'));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>QuizRoom</h1>
      <p>API: {health}</p>
      <p>Контракт підключено: час на питання за замовчуванням — {DEFAULT_TIME_LIMIT_SEC} с</p>
    </main>
  );
}
```
