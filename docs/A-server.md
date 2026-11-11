# Частина A — Сервер

Ти відповідаєш за все, що працює в Node: REST API квізів, кімнати, ігровий рушій, таймери, бали, ботів для демо. Клієнт паралельно пише кодер B; ви зустрінетесь тільки на етапі I, тому єдине, що вас звʼязує, — контракт.

- **Твоя зона:** `server/**`, `README.md`, `docs/progress-A.md`.
- **Тільки читати:** `shared/**`, `client/**`, решта `docs/**`.
- **Спершу прочитай:** `docs/00-common.md` повністю (особливо §2, §5, §6, §8) і `shared/src/index.ts`.

Клієнт B тобі для роботи не потрібен: кожен етап перевіряється тестами, `curl` і скриптом `npm run smoke`, який сам піднімає сервер і грає в гру через справжні сокети.

## Карта модулів

Це цільова структура. Тримайся її: на неї посилаються етапи.

```
server/
├── src/
│   ├── index.ts              # точка входу: createApp() + listen + лог адрес
│   ├── app.ts                # createApp(options): express + http + socket.io, без listen
│   ├── config.ts             # порт, шлях до даних, TTL кімнат, getLanIp()
│   ├── quiz/
│   │   ├── seed.ts           # демо-квізи
│   │   ├── quizStore.ts      # JSON-файл: читання, запис, CRUD
│   │   └── routes.ts         # REST-роутер /api
│   └── game/
│       ├── types.ts          # Room, Player, AnswerRecord, SocketData, типи io/socket
│       ├── scoring.ts        # calcPoints()
│       ├── engine.ts         # ЧИСТІ функції над Room: без io, без таймерів, без Date.now()
│       ├── views.ts          # Room → HostState / PlayerState / leaderboard
│       ├── roomManager.ts    # Map кімнат, генерація PIN, створення і видалення
│       └── sockets.ts        # події сокетів → engine → afterChange (таймер + розсилка)
├── scripts/
│   ├── helpers.ts            # спільне для smoke і bots: підключення, очікування стану
│   ├── smoke.ts              # самодостатній e2e-прогін
│   └── bots.ts               # боти й авто-ведучий для демо
└── data/quizzes.json         # створюється автоматично, у .gitignore
```

Тести лежать поруч із модулем: `engine.test.ts`, `scoring.test.ts`, `views.test.ts`, `quizStore.test.ts`.

**Головне архітектурне правило сервера.** `engine.ts` і `views.ts` — чисті: отримують `Room` і поточний час `now` аргументом, нічого не знають про сокети й таймери. Уся «брудна» робота (сокети, `setTimeout`, `Date.now()`) — тільки в `sockets.ts`. Так логіку гри можна протестувати без мережі, а на захисті показати один файл із правилами гри.

## Внутрішні типи (`server/src/game/types.ts`)

```ts
import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, Phase, Quiz, ServerToClientEvents } from '@quiz/shared';

export interface Player {
  id: string;
  name: string;
  score: number;
  /** Points for the most recently revealed question. */
  lastPoints: number;
  /** null while disconnected. */
  socketId: string | null;
  /** 0-based order of joining; tie-breaker for the leaderboard. */
  joinOrder: number;
}

export interface AnswerRecord {
  optionIndex: number;
  correct: boolean;
  /** Computed when the answer arrives, added to the score only at reveal. */
  points: number;
}

export interface Room {
  pin: string;
  /** Deep copy of the quiz taken when the room was created. */
  quiz: Quiz;
  phase: Phase;
  /** -1 in lobby. */
  questionIndex: number;
  /** Key: playerId. Insertion order = join order. */
  players: Map<string, Player>;
  /** Answers to the CURRENT question. Key: playerId. Cleared when a question starts. */
  answers: Map<string, AnswerRecord>;
  questionStartedAt: number | null;
  endsAt: number | null;
  /** Question timer. Touched ONLY by sockets.ts. */
  timer: ReturnType<typeof setTimeout> | null;
  createdAt: number;
}

export interface SocketData {
  role?: 'host' | 'player';
  pin?: string;
  playerId?: string;
}

export type QuizServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type QuizSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
```

---

## Етап A1 — REST API квізів, сховище, демо-дані

**Мета:** сервер зберігає квізи в JSON-файлі й надає CRUD з §6.1. Після першого запуску в системі вже є два демо-квізи.

**Залежить від:** 0. Перевірка: `npm run typecheck` зелений, `server/src/app.ts` існує.

**Файли:**

- створити `server/src/config.ts`, `server/src/quiz/seed.ts`, `server/src/quiz/quizStore.ts`, `server/src/quiz/routes.ts`, `server/src/quiz/quizStore.test.ts`;
- змінити `server/src/app.ts`, `server/src/index.ts`.

**Вимоги:**

1. `config.ts`:
   - `PORT` — `Number(process.env.PORT) || SERVER_PORT`;
   - `DATA_FILE` — `process.env.DATA_FILE` або `server/data/quizzes.json`, шлях обчислюється від розташування файлу через `fileURLToPath(new URL('../data/quizzes.json', import.meta.url))`, а не від поточної теки процесу;
   - `getLanIp(): string | null` — перша не-internal IPv4-адреса з `os.networkInterfaces()`.
2. `quizStore.ts` експортує `createQuizStore(filePath: string): QuizStore`:

   ```ts
   export interface QuizStore {
     list(): QuizSummary[];                              // новіші (updatedAt) першими
     get(id: string): Quiz | undefined;
     create(input: QuizInput): Quiz;
     update(id: string, input: QuizInput): Quiz | undefined;   // зберігає id і createdAt
     remove(id: string): boolean;
   }
   ```

   - Під час створення сховища: файлу немає → створити теку й записати демо-квізи; файл не парситься → `console.warn` і перезаписати демо-квізами.
   - Дані тримаються в памʼяті; кожна зміна синхронно переписує весь файл (`writeFileSync`, JSON з відступом 2).
   - `create`: `id = crypto.randomUUID()`, `createdAt = updatedAt = Date.now()`. Усі рядки (`title`, `text`, `options[]`) зберігаються обрізаними (`trim`).
   - Сховище не валідує — це робить роутер.
3. `seed.ts` експортує `SEED_QUIZZES: QuizInput[]` — два квізи українською:
   - «Веб-технології» — 6 питань (HTTP, WebSocket, браузер, TypeScript);
   - «Загальна ерудиція» — 5 питань.
   - Факти однозначні й загальновідомі, без спірних відповідей. Серед питань є хоча б одне з 2 варіантами («так / ні») і хоча б одне з 3. Ліміти часу — 10, 15 або 20 секунд. Правильні відповіді стоять на різних позиціях.
4. `routes.ts` експортує `createApiRouter(store: QuizStore): Router` з усіма маршрутами §6.1:
   - `POST`/`PUT` викликають `validateQuizInput(req.body)`; є помилки → 400 `{ error: 'Некоректні дані квізу', details }`;
   - невідомий `id` → 404 `{ error: 'Квіз не знайдено' }`;
   - `GET /config` → `{ lanIp: getLanIp() }`;
   - останнім у роутері — обробник «усе інше» → 404 `{ error: 'Не знайдено' }`.
5. `app.ts`: `createApp(options?: { dataFile?: string })` повертає `{ app, httpServer, store }`. Підключає `express.json()`, роутер на `/api`, і error-middleware з чотирма аргументами, який перетворює будь-яку помилку на JSON `ApiError`: зламаний JSON у тілі → 400 `{ error: 'Некоректний JSON' }`, решта → 500 `{ error: 'Внутрішня помилка сервера' }` плюс `console.error`.
6. `index.ts`: після `listen` друкує адресу `http://localhost:<PORT>` і, якщо є LAN-IP, `http://<LAN-IP>:<PORT>`.

**Поза межами етапу:** Socket.IO, кімнати, роздача статики клієнта.

**Acceptance criteria:**

- **A1-AC1.** `npm run typecheck` і `npm test` зелені.
- **A1-AC2.** Тести `quizStore.test.ts` (кожен на окремому тимчасовому файлі в `os.tmpdir()`, файл видаляється після тесту) покривають: файлу немає → створюється з 2 демо-квізами; зіпсований файл → перезаписується демо-даними; `create` → `get` повертає те саме; `update` змінює `updatedAt`, зберігає `id` і `createdAt`; `update`/`remove` неіснуючого → `undefined`/`false`; `list` відсортований за `updatedAt` за спаданням і містить правильний `questionCount`; нове сховище на тому самому файлі бачить збережені дані; рядки зберігаються обрізаними.
- **A1-AC3.** Тест: кожен елемент `SEED_QUIZZES` проходить `validateQuizInput` з порожнім списком помилок; квізів рівно 2, питань 6 і 5.
- **A1-AC4.** Після видалення `server/data` і запуску сервера `GET /api/quizzes` повертає 2 елементи.
- **A1-AC5.** Повний цикл через `curl`: `POST` валідного квізу → 201 з `id`; `GET /api/quizzes/:id` → той самий квіз; `PUT` → 200, `updatedAt` більший, `createdAt` той самий; `DELETE` → 204 з порожнім тілом; повторний `GET` → 404 з тілом `{"error":"Квіз не знайдено"}`.
- **A1-AC6.** `POST /api/quizzes` з тілом `{"title":"","questions":[]}` → 400, у `details` рівно два повідомлення.
- **A1-AC7.** `POST /api/quizzes` зі зламаним JSON (`{"title":`) → 400, `Content-Type: application/json`, без HTML і стек-трейсу в тілі.
- **A1-AC8.** `GET /api/nope` → 404 з JSON-тілом.
- **A1-AC9.** `GET /api/config` → `{"lanIp":"<IPv4>"}` або `{"lanIp":null}`.
- **A1-AC10.** Квіз, створений через API, лишається після перезапуску сервера.

**Перевірка:**

```bash
npm run typecheck && npm test
rm -rf server/data && npm run dev:server        # у фоні
curl -s localhost:3001/api/quizzes
curl -s -i -X POST localhost:3001/api/quizzes -H 'Content-Type: application/json' \
  -d '{"title":"Тест","questions":[{"text":"2+2?","options":["3","4"],"correctIndex":1,"timeLimitSec":10}]}'
curl -s -i -X POST localhost:3001/api/quizzes -H 'Content-Type: application/json' -d '{"title":"","questions":[]}'
curl -s -i -X POST localhost:3001/api/quizzes -H 'Content-Type: application/json' -d '{"title":'
curl -s -i localhost:3001/api/nope
curl -s localhost:3001/api/config
```

**Ручна перевірка:** відкрити `server/data/quizzes.json` і прочитати демо-питання: чи вони українською, чи відповіді справді правильні.

---

## Етап A2 — Кімнати і лобі через Socket.IO

**Мета:** ведучий створює кімнату, гравці заходять за PIN, усі отримують знімки стану; працюють перепідключення і перехоплення імені. Гра ще не стартує — тільки фаза `lobby`.

**Залежить від:** A1.

**Файли:**

- створити `server/src/game/types.ts` (вміст — вище), `roomManager.ts`, `engine.ts`, `views.ts`, `sockets.ts`, `engine.test.ts`, `views.test.ts`;
- створити `server/scripts/helpers.ts`, `server/scripts/smoke.ts`;
- змінити `server/src/app.ts`.

**Вимоги:**

1. `engine.ts` — чисті функції (сигнатури обовʼязкові):

   ```ts
   export function createRoomState(pin: string, quiz: Quiz, now: number): Room;
   /** Applies the join rules from docs/00-common.md §6.5.3 in that exact order. */
   export function joinPlayer(
     room: Room,
     input: { playerId: string; name: string; socketId: string },
   ): Ack<{ playerId: string }>;        // playerId може відрізнятись від переданого при перехопленні імені
   /** Marks the player owning this socket as disconnected. Returns that player, or null if none matched. */
   export function disconnectPlayer(room: Room, socketId: string): Player | null;
   ```

   - `createRoomState` робить `structuredClone(quiz)`, фаза `lobby`, `questionIndex = -1`.
   - `disconnectPlayer` скидає `socketId` лише якщо він **дорівнює** переданому: старий сокет, який відвалився після перепідключення, не повинен «відключити» гравця.
2. `views.ts` — чисті функції, що реалізують **усю** таблицю фаз §6.3 одразу (не тільки лобі):

   ```ts
   export function buildLeaderboard(room: Room): LeaderboardEntry[];   // бали ↓, потім joinOrder ↑; rank = позиція + 1
   export function buildHostState(room: Room, now: number): HostState;
   export function buildPlayerState(room: Room, playerId: string, now: number): PlayerState;
   ```

   `correctIndex` потрапляє у знімок тільки у фазах `reveal` і `leaderboard`. Питання перетворюється на `QuestionPublic` (без `correctIndex`).
3. `roomManager.ts` експортує фабрику `createRoomManager(): RoomManager`. Стан — одна `Map<string, Room>` усередині фабрики, а не на рівні модуля: так тести й smoke отримують незалежні екземпляри.

   ```ts
   export interface RoomManager {
     createRoom(quiz: Quiz): Room;            // унікальний PIN: 6 цифр, перша не нуль
     getRoom(pin: string): Room | undefined;
     deleteRoom(pin: string): void;
     listRooms(): Room[];
   }
   ```
4. `sockets.ts` експортує `registerSocketHandlers(io: QuizServer, deps: { store: QuizStore; rooms: RoomManager }): void`:
   - **`broadcast(room)`**: `const now = Date.now()`; `io.to('host:' + pin).emit('host:state', buildHostState(room, now))`; далі для кожного гравця з `socketId` — `io.to(socketId).emit('player:state', buildPlayerState(room, player.id, now))`.
   - **`afterChange(room)`** — єдина точка, яку викликають після будь-якої зміни кімнати. На цьому етапі вона лише викликає `broadcast`; на A3 сюди додасться керування таймером.
   - **`host:create`**: `quizId` не рядок → `BAD_REQUEST`; квізу немає → `QUIZ_NOT_FOUND`; інакше створити кімнату, привʼязати сокет як ведучого, `ack({ ok: true, pin })`, `afterChange`.
   - **`host:join`**: PIN не проходить `isValidPin` → `BAD_REQUEST`; кімнати немає → `ROOM_NOT_FOUND`; інакше привʼязати, `ack({ ok: true })`, `afterChange`.
   - Привʼязка ведучого: якщо сокет уже був ведучим іншої кімнати — `socket.leave` старої; `socket.data = { role: 'host', pin }`; `socket.join('host:' + pin)`.
   - **`player:join`**: `pin`, `name`, `playerId` мають бути рядками, `playerId` непорожній і не довший за 64 символи → інакше `BAD_REQUEST`; кімнати немає → `ROOM_NOT_FOUND`; далі `joinPlayer`. Успіх → `socket.data = { role: 'player', pin, playerId: <фактичний> }`, `ack({ ok: true })`, `afterChange`.
   - **`disconnect`**: якщо сокет — гравець і кімната ще існує → `disconnectPlayer`; якщо повернувся гравець → `afterChange`. Для ведучого нічого не робити.
   - Кожен обробник загорнутий у спільну обгортку `safe(handler)`: якщо останній аргумент не функція — подію проігнорувати; виняток усередині → `console.error` і `ack({ ok: false, error: 'BAD_REQUEST' })`. Сервер не має падати від жодного вхідного повідомлення.
5. `app.ts`: `createApp` створює `Server` з `cors: { origin: '*' }`, `createRoomManager()`, викликає `registerSocketHandlers` і повертає `{ app, httpServer, io, store, rooms }`.
6. `scripts/helpers.ts`: `connect(url): Promise<Socket>` (типізований клієнт, чекає `connect`), `waitFor<T>(socket, event, predicate, timeoutMs)` — проміс зі знімком, що задовольнив умову, або помилка з назвою очікування після таймауту.
7. `scripts/smoke.ts` — самодостатній: `createApp({ dataFile: <тимчасовий файл> })`, `listen(0)`, сценарій, прибирання, `process.exit(0)`. Будь-яке порушення очікування → зрозуміле повідомлення в `stderr` і `process.exit(1)`. Загальний таймаут прогону — 30 с. Останній рядок успішного прогону — `SMOKE OK`.

   Сценарій лобі (кожен крок друкує `✓ <назва>`):
   1. `host:create` з неіснуючим `quizId` → `QUIZ_NOT_FOUND`;
   2. `host:create` з першим квізом зі сховища → `pin` із 6 цифр; ведучий отримує `host:state` з фазою `lobby` і порожнім `players`;
   3. три гравці (`Оля`, `Тарас`, `Ірина`) виконують `player:join` → кожен отримує `player:state` зі своїм `me.name`; ведучий бачить 3 гравців у порядку входу; `playerCount` у гравців доходить до 3;
   4. четвертий сокет з іменем `оля` (інший регістр, інший `playerId`) → `NAME_TAKEN`;
   5. `player:join` з PIN `000000` → `ROOM_NOT_FOUND`; з іменем з 17 символів → `INVALID_NAME`;
   6. сокет Тараса закривається → ведучий бачить `connected: false` у Тараса, гравців усе ще 3;
   7. новий сокет із **тим самим** `playerId` Тараса → `connected: true`, гравців 3;
   8. сокет Ірини закривається; новий сокет з **новим** `playerId` та іменем `Ірина` → успіх (перехоплення), гравців усе ще 3, `me.id` дорівнює старому id Ірини;
   9. другий сокет виконує `host:join` з PIN → отримує такий самий `host:state`;
   10. `player:join` з payload `null` → `BAD_REQUEST`; сервер живий (наступний запит проходить).

**Поза межами етапу:** `host:next`, `player:answer`, таймери, бали (це A3). Обробники цих подій ще не реєструються.

**Acceptance criteria:**

- **A2-AC1.** `npm run typecheck` і `npm test` зелені.
- **A2-AC2.** `engine.test.ts` покриває `joinPlayer` за кожним пунктом §6.5.3: новий гравець; перепідключення за `playerId` (імʼя й бали лишаються, працює у фазі `finished`); `NAME_TAKEN` для підключеного тезки без урахування регістру й пробілів по краях; перехоплення відключеного тезки (повертається його `playerId`, бали збережені); `INVALID_NAME`; `GAME_FINISHED` для нового гравця; `ROOM_FULL` на 51-му гравцеві; порядок перевірок саме такий, як у §6.5.3.
- **A2-AC3.** `engine.test.ts` покриває `disconnectPlayer`: збіг `socketId` → `socketId = null`; чужий `socketId` → `null`, нічого не змінено.
- **A2-AC4.** `views.test.ts` для фази `lobby`: поля відповідають таблиці §6.3; `leaderboard` містить усіх гравців із `rank` за порядком входу; `serverNow` дорівнює переданому `now`.
- **A2-AC5.** `npm run smoke` проходить усі 10 кроків, друкує `SMOKE OK`, код виходу 0, процес завершується сам менш ніж за 10 с.
- **A2-AC6.** Кімната зберігає копію квізу: тест змінює обʼєкт квізу після `createRoomState` і перевіряє, що `room.quiz` не змінився.
- **A2-AC7.** У `engine.ts` і `views.ts` немає `Date.now()`, `setTimeout`, імпортів `socket.io` (перевірка `grep`).

**Перевірка:**

```bash
npm run typecheck && npm test && npm run smoke
grep -nE "Date\.now|setTimeout|socket\.io" server/src/game/engine.ts server/src/game/views.ts   # має бути порожньо
```

**Ручна перевірка:** не потрібна.

---

## Етап A3 — Ігровий рушій: фази, таймер, бали

**Мета:** повна гра на сервері: старт, відповіді, авто-завершення питання, підрахунок балів, таблиця лідерів, фінал. Після цього етапу серверна частина гри готова, і B може виконувати B5.

**Залежить від:** A2.

**Файли:**

- створити `server/src/game/scoring.ts`, `scoring.test.ts`;
- змінити `engine.ts`, `engine.test.ts`, `views.test.ts`, `sockets.ts`, `scripts/smoke.ts`.

**Вимоги:**

1. `scoring.ts`: `calcPoints(elapsedMs: number, limitMs: number): number` за формулою §6.6 (з `clamp`; константи — з `@quiz/shared`).
2. `engine.ts` — додати чисті функції:

   ```ts
   /** host:next — transition table from docs/00-common.md §6.4. */
   export function advance(room: Room, now: number): Ack;
   export function submitAnswer(room: Room, playerId: string, optionIndex: number, now: number): Ack;
   /** true when phase is `question`, at least one player is connected and every connected player has answered. */
   export function shouldAutoReveal(room: Room): boolean;
   /** question → reveal: adds points to scores, sets lastPoints for EVERY player (0 if no answer). */
   export function reveal(room: Room): void;
   ```

   - Старт питання `i`: `phase = 'question'`, `questionIndex = i`, `answers.clear()`, `questionStartedAt = now`, `endsAt = now + timeLimitSec * 1000`.
   - `submitAnswer`, порядок перевірок: фаза не `question` → `NOT_ACCEPTING_ANSWERS`; гравця немає → `NOT_IN_ROOM`; уже відповів → `ALREADY_ANSWERED`; `optionIndex` не ціле або поза межами варіантів → `INVALID_OPTION`. Успіх: записати `AnswerRecord` з `points = correct ? calcPoints(now - questionStartedAt, limitMs) : 0`. `player.score` тут **не змінюється**.
   - `reveal`: `phase = 'reveal'`, `endsAt = null`; для кожного гравця `lastPoints = answers.get(id)?.points ?? 0`, `score += lastPoints`.
   - `advance` у фазі `question` викликає `reveal`.
3. `sockets.ts`:
   - **`syncTimer(room)`**: `clearTimeout(room.timer)`, `room.timer = null`; якщо фаза `question` — поставити `setTimeout` на `Math.max(0, room.endsAt - Date.now())`, який перевіряє, що фаза досі `question`, викликає `reveal(room)` і `afterChange(room)`.
   - **`afterChange(room)`** тепер: `syncTimer(room)`, потім `broadcast(room)`. Викликати `syncTimer` після кожної зміни безпечно: дедлайн береться з `endsAt`, а не відлічується заново.
   - **`host:next`**: сокет не ведучий або кімнати немає → `NOT_IN_ROOM`; `res = advance(room, Date.now())`; `ack(res)`; якщо `ok` → `afterChange`.
   - **`player:answer`**: сокет не гравець або кімнати немає → `NOT_IN_ROOM`; `optionIndex` не число → `BAD_REQUEST`; `res = submitAnswer(...)`; `ack(res)`; якщо `ok` → `if (shouldAutoReveal(room)) reveal(room)`, потім `afterChange`.
   - **`disconnect`** гравця: після `disconnectPlayer` → `if (shouldAutoReveal(room)) reveal(room)`, потім `afterChange`. Без цього гра зависне до таймера, якщо останній, хто не відповів, вийшов.
4. `smoke.ts` — додати сценарій повної гри після сценарію лобі. Скрипт сам створює через `store.create` квіз із 3 питань, усі з `timeLimitSec: 5` (мінімум), і грає трьома гравцями:
   1. `host:next` у новій кімнаті без гравців → `NO_PLAYERS`;
   2. після входу гравців `host:next` → усі отримують фазу `question`, `questionIndex: 0`, `endsAt − serverNow` у межах 4800…5000 мс, `correctIndex: null`;
   3. `player:answer` поза діапазоном → `INVALID_OPTION`; усі троє відповідають (один правильно одразу, один правильно через ~1 с, один неправильно) → `reveal` настає **менш ніж за 500 мс після останньої відповіді** (не чекаючи таймера); повторна відповідь → `NOT_ACCEPTING_ANSWERS`;
   4. у `reveal`: `correctIndex` дорівнює правильному; `answerCounts` у сумі 3; швидший правильний гравець отримав більше балів, ніж повільніший; у неправильного `lastResult = { correct: false, points: 0 }`; `me.score` дорівнює `lastResult.points`;
   5. `host:next` → `leaderboard` (порядок і `rank` відповідають балам) → `host:next` → питання 1;
   6. на питанні 1 відповідає один гравець, потім він же ще раз → `ALREADY_ANSWERED`; ведучий тисне `host:next` → `reveal` достроково; у тих, хто не відповів, `myAnswer: null`, `points: 0`;
   7. питання 2: ніхто не відповідає → `reveal` настає за таймером через 4500…6500 мс після старту питання;
   8. `host:next` після останнього `reveal` → `finished` (без `leaderboard`); `question: null`; `leaderboard` у ведучого збігається з `me.score` / `me.rank` кожного гравця; `host:next` → `GAME_FINISHED`;
   9. упродовж усього прогону жоден знімок у фазі `question` не мав `correctIndex !== null`, а `me.score` у фазі `question` не змінювався після відповіді.

**Поза межами етапу:** боти (A4), час життя кімнати, статика, логи (A5).

**Acceptance criteria:**

- **A3-AC1.** `npm run typecheck` і `npm test` зелені.
- **A3-AC2.** `scoring.test.ts`: `calcPoints(0, 20000) = 1000`; `(10000, 20000) = 750`; `(20000, 20000) = 500`; `(30000, 20000) = 500`; `(-5, 20000) = 1000`; результат завжди ціле число.
- **A3-AC3.** `engine.test.ts` проходить повний шлях для квізу з 2 питань: `lobby → question(0) → reveal → leaderboard → question(1) → reveal → finished`, і перевіряє: `advance` у `finished` → `GAME_FINISHED`; у `lobby` без гравців → `NO_PLAYERS`; для квізу з 1 питання після `reveal` одразу `finished`.
- **A3-AC4.** `engine.test.ts` покриває `submitAnswer`: усі чотири помилки в правильному порядку; після успішної відповіді `player.score` не змінився; після `reveal` — змінився рівно на `points`; у гравця без відповіді `lastPoints = 0` (навіть якщо на попередньому питанні було більше).
- **A3-AC5.** `engine.test.ts` покриває `shouldAutoReveal`: усі підключені відповіли → `true`; один підключений не відповів → `false`; не відповів лише відключений → `true`; підключених нуль → `false`; фаза не `question` → `false`.
- **A3-AC6.** `views.test.ts` перевіряє таблицю §6.3 для фаз `question`, `reveal`, `leaderboard`, `finished`: значення кожного поля; `answerCounts.length` дорівнює кількості варіантів, а сума — кількості відповідей; `myAnswer` і `lastResult` для того, хто відповів правильно, неправильно і не відповів; рівні бали сортуються за порядком входу; `top` — не більше `LEADERBOARD_SIZE` записів.
- **A3-AC7.** `npm run smoke` проходить сценарій лобі і всі 9 кроків сценарію гри, друкує `SMOKE OK`, код виходу 0, завершується сам менш ніж за 30 с.
- **A3-AC8.** `engine.ts`, `views.ts`, `scoring.ts` досі чисті (той самий `grep`, що в A2-AC7).
- **A3-AC9.** Таймер не залишає сміття: після `finished` у кімнаті `timer === null` (перевіряється в smoke через `rooms.getRoom(pin)`).

**Перевірка:**

```bash
npm run typecheck && npm test && npm run smoke
grep -nE "Date\.now|setTimeout|socket\.io" server/src/game/engine.ts server/src/game/views.ts server/src/game/scoring.ts
```

**Ручна перевірка:** не потрібна. Після мерджу в `main` повідом кодера B: настала точка синхронізації SP2.

---

## Етап A4 — Боти й авто-ведучий для демо

**Мета:** скрипт, який наповнює кімнату правдоподібними «гравцями» і вміє сам провести гру. Він потрібен для презентації (жива таблиця лідерів) і кодеру B для перевірки екранів без десяти телефонів.

**Залежить від:** A3.

**Файли:** створити `server/scripts/bots.ts`; за потреби доповнити `server/scripts/helpers.ts`.

**Вимоги:**

1. Запуск: `npm run bots -- <прапорці>`. Аргументи розбираються через `parseArgs` з `node:util` (без залежностей). Скрипт підключається до **вже запущеного** сервера.

   | Прапорець | За замовчуванням | Значення |
   |---|---|---|
   | `--url <адреса>` | `http://localhost:3001` | адреса сервера |
   | `--pin <PIN>` | — | зайти ботами в наявну кімнату |
   | `--autohost` | вимкнено | самому створити кімнату й вести гру |
   | `--quiz <id>` | перший зі списку | який квіз запускати (тільки з `--autohost`) |
   | `--count <n>` | `10` | кількість ботів (з `--autohost` можна `0`) |
   | `--skip <0..1>` | `0.1` | імовірність, що бот не відповість на питання |
   | `--lobby-wait <с>` | `15` | скільки авто-ведучий чекає в лобі перед стартом |
   | `--step-delay <с>` | `4` | пауза авто-ведучого перед кожним «Далі» |
   | `--help` | — | надрукувати цю таблицю і вийти |

   Має бути вказано рівно одне з `--pin` або `--autohost`; інакше — підказка і код виходу 1.
2. Бот: `playerId = 'bot-' + <випадковий рядок>`; імʼя — з вбудованого списку щонайменше 40 українських імен; на `NAME_TAKEN` пробує те саме імʼя з числом (`Оля 2`, `Оля 3`…), до 5 спроб. На кожне питання (перехід у фазу `question` з новим `questionIndex`): з імовірністю `--skip` мовчить, інакше через випадкову затримку від 1 с до 70% ліміту часу обирає випадковий варіант. Бот не знає правильної відповіді й не намагається її дізнатись.
3. Авто-ведучий: `host:create` → друкує PIN і адресу для входу в dev-режимі (`http://<LAN-IP>:5173/?pin=<PIN>`, LAN-IP — з `GET /api/config`; якщо його немає — `localhost`); чекає `--lobby-wait`; далі діє за фазою: `lobby`, `reveal`, `leaderboard` → через `--step-delay` надсилає `host:next`; у фазі `question` нічого не надсилає (чекає таймер або авто-перехід).
4. Вивід — по одному рядку на подію: підключення, старт питання (`Питання 2/6`), `reveal` (`відповіли 7/10`), фінал (топ-5 з балами). Жодного рядка на кожен знімок стану.
5. Завершення: фаза `finished` → надрукувати топ-5, відключитись, `process.exit(0)`; `room:closed` → `exit(0)`; `ROOM_NOT_FOUND` під час входу → надрукувати `ERROR_MESSAGES.ROOM_NOT_FOUND`, `exit(1)`; сервер недоступний упродовж 5 с → зрозуміле повідомлення, `exit(1)`; `Ctrl+C` → відключити всіх і вийти.

**Поза межами етапу:** «розумні» боти, імітація обривів звʼязку, навантажувальне тестування.

**Acceptance criteria:**

- **A4-AC1.** `npm run typecheck`, `npm test`, `npm run smoke` зелені.
- **A4-AC2.** При запущеному `npm run dev:server` команда `npm run bots -- --autohost --count 8 --lobby-wait 2 --step-delay 1` проводить перший квіз до кінця, друкує PIN, рядок на кожне питання й фінальний топ-5, код виходу 0.
- **A4-AC3.** `npm run bots -- --pin 000000` друкує «Гру з таким кодом не знайдено», код виходу 1.
- **A4-AC4.** `npm run bots` без `--pin` і `--autohost`, а також `--help` друкують підказку з усіма прапорцями.
- **A4-AC5.** Два процеси в одній кімнаті: перший `--autohost --count 5 --lobby-wait 20`, другий `--pin <PIN> --count 30` → усі 35 гравців у кімнаті, жодного падіння через `NAME_TAKEN` (спрацьовують імена з числами), гра доходить до фіналу, обидва процеси завершуються з кодом 0.
- **A4-AC6.** `--skip 1` → ніхто не відповідає, кожне питання завершується за таймером; `--skip 0` → усі відповідають, питання завершуються раніше ліміту часу.
- **A4-AC7.** При зупиненому сервері `npm run bots -- --autohost` завершується з кодом 1 і зрозумілим повідомленням не пізніше ніж за 6 с.

**Перевірка:**

```bash
npm run typecheck && npm test && npm run smoke
npm run dev:server                                   # у фоні
npm run bots -- --autohost --count 8 --lobby-wait 2 --step-delay 1; echo "exit=$?"
npm run bots -- --pin 000000; echo "exit=$?"
npm run bots -- --help
```

**Ручна перевірка:** не потрібна. Після мерджу повідом кодера B, що боти доступні: `--autohost --lobby-wait 30` дає йому гру, в яку можна зайти з вкладки як гравець.

---

## Етап A5 — Режим одного порту, час життя кімнат, логи, README

**Мета:** сервер готовий до презентації: уміє сам роздавати зібраний клієнт на одному порту, прибирає старі кімнати, пише зрозумілі логи, має README.

**Залежить від:** A4. Для перевірки статики потрібен будь-який `client/dist` — підійде збірка поточного стану `main`, навіть заглушка етапу 0.

**Файли:** змінити `server/src/app.ts`, `server/src/config.ts`, `server/src/index.ts`, `server/src/game/sockets.ts`, `server/src/game/roomManager.ts`, `server/scripts/smoke.ts`, `README.md`.

**Вимоги:**

1. **Статика.** Якщо існує `client/dist/index.html` (шлях обчислюється від розташування файлу, як `DATA_FILE`), `createApp` підключає `express.static(dist)` і SPA-фолбек. Порядок middleware: `/api`-роутер (зі своїм 404) → статика → фолбек `app.use((req, res) => res.sendFile(indexHtml))` для GET-запитів. Не використовуй `app.get('*')` (G4). Якщо `client/dist` немає — сервер працює як API, а при старті друкує підказку `npm run build`.
2. **Час життя кімнати.** `ROOM_TTL_MS` у `config.ts`: `Number(process.env.ROOM_TTL_MS) || 2 * 60 * 60 * 1000`. `createApp` приймає `options.roomTtlMs` (для smoke). Під час створення кімнати ставиться таймер із `.unref()` (G10), який викликає `closeRoom(pin)`: `clearTimeout(room.timer)`, `room:closed` усім сокетам ведучого і всім підключеним гравцям, видалення з `Map`.
3. **Логи.** Один рядок на подію, з PIN на початку: створено кімнату (назва квізу), гравець зайшов (імʼя, скільки всього), перепідключився, вийшов, старт питання (`2/6`), `reveal` (`відповіли 7/9`), фінал, кімнату закрито. Без логів на кожну розсилку знімка.
4. **Стартовий банер** у `index.ts`: адреса для ведучого і для гравців у поточному режимі. Є `client/dist` → `http://localhost:<PORT>/quizzes` і `http://<LAN-IP>:<PORT>`; немає → те саме з портом 5173 і позначкою «dev-режим: запустіть npm run dev».
5. **smoke** — додати останній сценарій: `createApp({ roomTtlMs: 1500 })`, створити кімнату, зайти гравцем → приблизно через 1,5 с і ведучий, і гравець отримують `room:closed`; `host:join` з цим PIN → `ROOM_NOT_FOUND`.
6. **README.md** — фінальна версія: що це (2–3 речення); швидкий старт (`npm install`, `npm run dev`, адреси); режим одного порту (`npm run build`, `npm start`); боти (приклади команд); як підключити телефони (та сама мережа, LAN-адреса з консолі, G2, G3); структура репозиторію; «як це працює» — чотири принципи з §2 своїми словами; посилання на `docs/00-common.md` §11 (сценарій демо).

**Поза межами етапу:** деплой, Docker, HTTPS, тунелі.

**Acceptance criteria:**

- **A5-AC1.** `npm run typecheck`, `npm test`, `npm run smoke` зелені; smoke завершується сам менш ніж за 30 с.
- **A5-AC2.** Після `npm run build && npm start`: `curl -s localhost:3001/` і `curl -s localhost:3001/host/123456` повертають HTML з `<div id="root">`; `curl -s localhost:3001/api/health` → `{"ok":true}`; `curl -s -i localhost:3001/api/nope` → 404 з JSON, а не HTML.
- **A5-AC3.** Гра працює на одному порту: при запущеному `npm start` команда `npm run bots -- --autohost --count 5 --lobby-wait 1 --step-delay 1 --url http://localhost:3001` доходить до фіналу.
- **A5-AC4.** Без `client/dist` (`rm -rf client/dist && npm start`) сервер стартує, API працює, у консолі є підказка про `npm run build`.
- **A5-AC5.** Сценарій TTL у smoke проходить: `room:closed` отримано обома, далі `ROOM_NOT_FOUND`.
- **A5-AC6.** Під час прогону `bots --autohost` у консолі сервера є по одному рядку на кожну подію з вимоги 3 і немає рядків на кожен знімок.
- **A5-AC7.** README дозволяє запустити проєкт із нуля: усі команди з нього виконуються без помилок на чистому клоні.

**Перевірка:**

```bash
npm run typecheck && npm test && npm run smoke
npm run build && npm start                           # у фоні
curl -s localhost:3001/ | grep -c 'id="root"'
curl -s localhost:3001/host/123456 | grep -c 'id="root"'
curl -s -i localhost:3001/api/nope | head -n 12
npm run bots -- --autohost --count 5 --lobby-wait 1 --step-delay 1
```

**Ручна перевірка:** відкрити `http://<LAN-IP>:3001` з телефона в режимі `npm start`; прочитати README очима людини, яка бачить проєкт уперше.
