# Частина B — Клієнт

Ти відповідаєш за все, що бачать люди: вхід гравця, екрани гри на телефоні, екрани ведучого на проєкторі, список і редактор квізів. Сервер паралельно пише кодер A; ви зустрінетесь тільки на етапі I, тому єдине, що вас звʼязує, — контракт.

- **Твоя зона:** `client/**`, `docs/progress-B.md`.
- **Тільки читати:** `shared/**`, `server/**`, решта `docs/**`.
- **Спершу прочитай:** `docs/00-common.md` повністю (особливо §2, §5, §6, §8) і `shared/src/index.ts`.

Перші три етапи (B1–B3) не потребують сервера: усі ігрові екрани — чисті компоненти, які малюються з фікстур у галереї `/dev`. Сервер потрібен з B4 (REST, готовий після A1) і B5 (сокети, готові після A3).

## Карта модулів

Це цільова структура. Тримайся її: на неї посилаються етапи.

```
client/src/
├── main.tsx
├── App.tsx                    # BrowserRouter + Routes
├── styles/
│   ├── tokens.css             # CSS-змінні (нижче)
│   └── global.css             # reset, база, типографіка
├── lib/                       # чисті функції та «тонкі» обгортки; покриваються unit-тестами
│   ├── api.ts                 # REST-клієнт
│   ├── socket.ts              # типізований сокет-синглтон
│   ├── session.ts             # ідентичність гравця в sessionStorage
│   ├── id.ts                  # createId() без crypto
│   ├── joinUrl.ts             # buildJoinUrl()
│   ├── time.ts                # getRemainingMs()
│   ├── format.ts              # plural(), formatScore()
│   └── quizDraft.ts           # чисті операції над чернеткою квізу (B4)
├── hooks/
│   ├── useConnection.ts
│   ├── useCountdown.ts
│   ├── useHostRoom.ts         # B5
│   └── usePlayerRoom.ts       # B5
├── components/
│   ├── ui/                    # Button, TextInput, Card, Spinner, Notice, Logo, Screen
│   └── game/                  # OptionTile, OptionList, TimerBar, PinDisplay, JoinQr, PlayerChips,
│                              # AnswerBars, LeaderboardList, Podium, PlayerHeader, ConnectionBanner
├── screens/                   # ЧИСТІ екрани: props → JSX
│   ├── host/                  # HostLobby, HostQuestion, HostReveal, HostLeaderboard, HostFinished
│   └── player/                # PlayerLobby, PlayerQuestion, PlayerAnswered, PlayerReveal,
│                              # PlayerLeaderboard, PlayerFinished
├── pages/                     # маршрути: хуки + вибір екрана за фазою
│   ├── JoinPage.tsx  PlayerGamePage.tsx  QuizListPage.tsx  QuizEditorPage.tsx
│   └── HostGamePage.tsx  DevGalleryPage.tsx  NotFoundPage.tsx
└── fixtures/
    └── states.ts              # HostState / PlayerState для кожної фази
```

**Головне архітектурне правило клієнта.** Три шари, залежності тільки вниз:

- `pages/` знають про сокет, REST і роутер; обирають екран за `state.phase`;
- `screens/` і `components/` — чисті: отримують дані й колбеки через props, **не імпортують** `lib/socket`, `lib/api`, `react-router-dom` і хуки з побічними ефектами (виняток — `useCountdown`);
- `lib/` — без React.

Так кожен екран можна відкрити в `/dev` на фікстурі без сервера, а на захисті показати, що клієнт — це функція «стан → екран».

**Стилі.** CSS Modules: поруч із компонентом лежить `Name.module.css`. Глобальні тільки `tokens.css` і `global.css`. Кольори, відступи, радіуси — лише через змінні з `tokens.css`; «голих» hex-кольорів у модулях бути не повинно.

**Тести.** Unit-тести (vitest) пишемо тільки для чистих функцій у `lib/` і для фікстур. Тестів компонентів немає: jsdom і testing-library не встановлені, і ставити їх не можна (R3).

## Дизайн-система

Власна айдентика: темна «сцена», яскраві плитки варіантів. Не копіюємо оформлення жодного наявного продукту: варіанти відповідей позначаються **літерами A–D** (`OPTION_LETTERS`), а не фігурами.

`client/src/styles/tokens.css`:

```css
:root {
  --bg: #12102a;
  --surface: #1e1b45;
  --surface-2: #2a2660;
  --border: #3b3780;
  --text: #f5f4ff;
  --text-muted: #aaa6d6;
  --accent: #8b7bff;
  --accent-strong: #6c57ff;
  --success: #22c58b;
  --danger: #ff5d73;
  --warning: #ffc24b;

  /* answer options: index 0..3 */
  --opt-0: #7c3aed;
  --opt-1: #0284c7;
  --opt-2: #ea580c;
  --opt-3: #db2777;

  --radius-s: 8px;
  --radius-m: 14px;
  --radius-l: 24px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;

  --font: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --shadow: 0 8px 24px rgb(0 0 0 / 0.35);
}
```

Два формати екранів:

| Формат | Де | Розміри для перевірки | Правила |
|---|---|---|---|
| **phone** | вхід, екрани гравця | 360×640, 390×844, 430×932 | одна колонка, ширина контенту до 480px, кнопки на всю ширину, висота натискання ≥ 56px, без горизонтального скролу |
| **stage** | екрани ведучого | 1280×720, 1920×1080 | на весь екран без скролу, шрифти через `clamp()` від ширини вікна, читається з останнього ряду аудиторії |

Сторінки квізів (`/quizzes…`) — звичайна сторінка для ноутбука: контент до 880px, вертикальний скрол дозволений.

Орієнтири розмірів для stage: PIN — `clamp(64px, 11vw, 168px)`; текст питання — `clamp(28px, 3.6vw, 60px)`; текст варіанта — `clamp(20px, 2.4vw, 40px)`.

---

## Етап B1 — Каркас клієнта: роутинг, дизайн-токени, UI-кіт

**Мета:** скелет застосунку: усі маршрути відкриваються, є дизайн-токени, базові компоненти й допоміжні модулі `lib/`. Далі на цьому будуються всі екрани.

**Залежить від:** 0. Перевірка: `npm run typecheck` зелений, `client/src/App.tsx` — заглушка.

**Файли:**

- змінити `client/src/main.tsx`, `client/src/App.tsx`, `client/index.html`;
- створити `styles/tokens.css`, `styles/global.css`;
- створити `lib/api.ts`, `lib/socket.ts`, `lib/session.ts`, `lib/id.ts`, `lib/joinUrl.ts`, `lib/time.ts`, `lib/format.ts` і тести `lib/*.test.ts`;
- створити `hooks/useConnection.ts`;
- створити `components/ui/*` (7 компонентів);
- створити всі сторінки з `pages/` як заглушки.

**Вимоги:**

1. **Роутинг** (`App.tsx`): `BrowserRouter` + `Routes` з маршрутами §6.8. Невідомий шлях → `NotFoundPage` («Сторінку не знайдено» + кнопка «На головну» → `/`). Сторінки-заглушки показують свою назву й параметри маршруту; їх замінять наступні етапи.
2. **`global.css`**: `box-sizing: border-box` для всього; `body` — `margin: 0`, фон `--bg`, колір `--text`, шрифт `--font`, `min-height: 100dvh` (G7), `overscroll-behavior: none`; `input, textarea, select, button` — `font: inherit`, розмір шрифту полів ≥ 16px (G8); `button` — `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent`; видимий `:focus-visible`.
3. **UI-кіт** (`components/ui/`), кожен зі своїм `.module.css`:
   - `Button` — `variant: 'primary' | 'secondary' | 'ghost' | 'danger'`, `size: 'm' | 'l'`, `fullWidth?`, `loading?` (показує `Spinner` і блокує), решта — нативні пропси `<button>`;
   - `TextInput` — `label`, `error?`, нативні пропси `<input>`; `label` звʼязаний з полем;
   - `Card`; `Spinner`; `Notice` — `tone: 'info' | 'error' | 'success'`; `Logo` — текстовий логотип «QuizRoom»;
   - `Screen` — обгортка-макет: `variant: 'phone' | 'stage' | 'page'` (правила — у таблиці форматів вище).
4. **`lib/id.ts`**: `createId(): string` — `Math.random().toString(36).slice(2, 10) + Date.now().toString(36)`. Без `crypto` (G1).
5. **`lib/session.ts`**: тип `PlayerSession = { pin: string; name: string; playerId: string }`; `loadSession()`, `saveSession(s)`, `clearSession()`; ключ `quizroom.player`; сховище — `sessionStorage` (G6). Зіпсований JSON або недоступне сховище → `null`, без винятків.
6. **`lib/joinUrl.ts`**: `buildJoinUrl(pin: string, lanIp: string | null, loc: Pick<Location, 'protocol' | 'hostname' | 'port'> = window.location): string` — правило з §6.8.
7. **`lib/time.ts`**: `getRemainingMs(endsAt: number | null, clockOffset: number, now: number): number` — формула з §6.7; для `null` → `0`; ніколи не відʼємне.
8. **`lib/format.ts`**: `plural(n, ['гравець', 'гравці', 'гравців'])` — українські правила множини (1, 2–4, 5–20, 21, 22…; 11–14 — третя форма); `formatScore(n)` — розряди через нерозривний пробіл (`1 250`).
9. **`lib/api.ts`**: `getConfig()`, `listQuizzes()`, `getQuiz(id)`, `createQuiz(input)`, `updateQuiz(id, input)`, `deleteQuiz(id)` — типи з контракту. Не-2xx → кидає `ApiRequestError` (клас з полями `status`, `details`), `message` береться з `ApiError.error`. Помилка мережі → `ApiRequestError` зі `status: 0` і текстом «Сервер недоступний».
10. **`lib/socket.ts`**: `export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();` — один екземпляр на рівні модуля, той самий origin (у dev запити йдуть через проксі Vite). Ніде більше `io()` не викликається (G5).
11. **`hooks/useConnection.ts`**: повертає `boolean` — чи підключений сокет; підписка на `connect`/`disconnect` з відпискою в cleanup.
12. **`/dev`** на цьому етапі — вітрина UI-кіта: усі варіанти `Button` (включно з `loading` і `disabled`), `TextInput` (звичайний, з помилкою), `Notice` усіх тонів, `Card`, `Spinner`, `Logo`.
13. **`index.html`**: `<title>QuizRoom</title>`, `<meta name="theme-color" content="#12102a">`, `lang="uk"`.

**Поза межами етапу:** ігрові компоненти й екрани (B2, B3), реальні сторінки (B4, B5), будь-які виклики `socket.emit`.

**Acceptance criteria:**

- **B1-AC1.** `npm run typecheck`, `npm test`, `npm run build` зелені.
- **B1-AC2.** Тести `joinUrl`: `localhost:5173` + `lanIp` → `http://<lanIp>:5173/?pin=123456`; `127.0.0.1` + `lanIp` → так само; `localhost` + `lanIp: null` → `http://localhost:5173/?pin=123456`; `192.168.1.7:5173` → без змін хоста; `https://demo.example.com` без порту → `https://demo.example.com/?pin=123456`.
- **B1-AC3.** Тести `time`: до дедлайну → додатний залишок з урахуванням `clockOffset`; після → `0`; `endsAt: null` → `0`.
- **B1-AC4.** Тести `format`: `plural` для 0, 1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111; `formatScore(0) = '0'`, `formatScore(1250)` містить розділювач розрядів.
- **B1-AC5.** Тести `id`: 1000 викликів `createId()` дають 1000 різних рядків.
- **B1-AC6.** Тести `session` з підміненим сховищем: зберегти → прочитати те саме; зіпсований JSON → `null`; `clearSession` → `null`.
- **B1-AC7.** Кожен маршрут із §6.8 відкривається без помилок і попереджень у консолі; невідомий шлях показує `NotFoundPage`.
- **B1-AC8.** `/dev` показує всі компоненти UI-кіта в усіх варіантах; на ширині 360px нічого не вилазить за екран.
- **B1-AC9.** `grep -RnE "randomUUID|localStorage|100vh" client/src client/index.html` — порожньо.
- **B1-AC10.** `grep -RnE "https?://" client/src client/index.html | grep -v "w3.org" | grep -v "\.test\.ts"` — порожньо (жодних зовнішніх адрес, R8).
- **B1-AC11.** `grep -RnE "\bio\(" client/src --include=*.ts --include=*.tsx | grep -v "lib/socket.ts"` — порожньо (сокет створюється в одному місці).

**Перевірка:**

```bash
npm run typecheck && npm test && npm run build
grep -RnE "randomUUID|localStorage|100vh" client/src client/index.html
grep -RnE "https?://" client/src client/index.html | grep -v "w3.org" | grep -v "\.test\.ts"
grep -RnE "\bio\(" client/src --include=*.ts --include=*.tsx | grep -v "lib/socket.ts"
npm run dev:client      # відкрити /, /quizzes, /quizzes/new, /host/123456, /play/123456, /dev, /nope
```

**Ручна перевірка:** відкрити `/dev` на ноутбуці й у режимі телефона (DevTools, 390×844): компоненти виглядають цілісно, фокус з клавіатури видно.

---

## Етап B2 — Ігрові компоненти, фікстури, екрани ведучого, галерея `/dev`

**Мета:** усі пʼять екранів ведучого намальовані й перевірені на фікстурах; є галерея, де видно кожен екран у кожному стані без сервера.

**Залежить від:** B1.

**Файли:**

- створити `hooks/useCountdown.ts`;
- створити `components/game/*` (крім `PlayerHeader` і `ConnectionBanner` — вони в B3 і B5);
- створити `fixtures/states.ts`, `fixtures/states.test.ts`;
- створити `screens/host/*`;
- переписати `pages/DevGalleryPage.tsx`.

**Вимоги:**

1. **`useCountdown(endsAt: number | null, clockOffset: number, totalMs: number)`** → `{ remainingMs, secondsLeft, fraction }`: оновлюється кожні 100 мс через `setInterval` з очищенням; `secondsLeft = Math.ceil(remainingMs / 1000)`; `fraction` — від 1 до 0. Обчислення — через `getRemainingMs`.
2. **Компоненти** (`components/game/`):
   - `OptionTile` — `index`, `text`, `size: 'stage' | 'phone'`, `state: 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed'`, `count?`, `onClick?`, `disabled?`. Плитка кольору `--opt-<index>` з бейджем-літерою і текстом; з `onClick` рендериться як `<button>`. `correct` — рамка `--success` і позначка ✓; `wrong` — позначка ✗; `dimmed` — напівпрозора. Довгий текст переноситься і обрізається після 3 рядків.
   - `OptionList` — розкладка плиток: для `stage` сітка 2×2 (2 варіанти — один ряд, 3 — два ряди, третій на всю ширину); для `phone` — одна колонка, плитки ділять доступну висоту порівну.
   - `TimerBar` — `fraction`, `secondsLeft`: смуга, що скорочується, і число секунд; при `secondsLeft ≤ 5` колір `--warning`.
   - `PinDisplay` — PIN великими цифрами з проміжком посередині (`123 456`).
   - `JoinQr` — `url`: `QRCodeSVG` на білій підкладці з полями, під ним адреса без `http://`.
   - `PlayerChips` — `players: PlayerInfo[]`: чипи з іменами; відключені — напівпрозорі; область переносить рядки й прокручується всередині себе.
   - `AnswerBars` — `options`, `answerCounts`, `correctIndex`: стовпчик на кожен варіант, висота пропорційна кількості відповідей, над ним число; правильний виділено. Нуль відповідей — стовпчики нульової висоти, без ділення на нуль.
   - `LeaderboardList` — `entries`, `highlightId?`, `showDelta?`: рядки «місце · імʼя · бали» і `+850` для `lastPoints > 0`.
   - `Podium` — `entries` (перші 1–3): три сходинки, 1-ше місце в центрі й найвище; працює і для 1, і для 2 гравців.
3. **Фікстури** (`fixtures/states.ts`): `hostFixtures: Record<string, HostState>` і `playerFixtures: Record<string, PlayerState>`. Кожна — валідний знімок за таблицею §6.3. Для фази `question` значення `endsAt` і `serverNow` у файлі — будь-які; галерея підміняє їх під час показу.

   | Ключ `hostFixtures` | Що перевіряє |
   |---|---|
   | `lobby-empty` | 0 гравців, кнопка старту неактивна |
   | `lobby-few` | 3 гравці, один відключений |
   | `lobby-full` | 40 гравців, імена по 16 символів |
   | `question-4` | 4 варіанти, відповіли 12 з 20 |
   | `question-2` | 2 варіанти («Так» / «Ні») |
   | `question-3` | 3 варіанти |
   | `question-long` | питання 200 символів, варіанти по 80 |
   | `reveal-4` | розподіл 3 / 9 / 2 / 6, правильний — другий |
   | `reveal-none` | ніхто не відповів |
   | `leaderboard` | 12 гравців, топ-5 з `lastPoints` |
   | `finished-many` | 12 гравців |
   | `finished-two` | 2 гравці (неповний пʼєдестал) |

   Фікстури гравця додаються на B3.
4. **`fixtures/states.test.ts`**: проганяє **всі** фікстури (і ведучого, і гравця) через перевірку таблиці §6.3: для кожної фази — які поля `null`, які ні; `questionIndex` у межах; `answerCounts.length === question.options.length`; `leaderboard` відсортований і `rank` іде 1, 2, 3…
5. **Екрани ведучого** (`screens/host/`). Спільні props: `state: HostState`, `clockOffset: number`, `onNext: () => void`, `busy: boolean`. У `HostLobby` додатково `joinUrl: string`.

   | Екран | Вміст | Кнопка |
   |---|---|---|
   | `HostLobby` | назва квізу; ліворуч `JoinQr`; праворуч «Код гри» і `PinDisplay`; нижче «Гравців: N» і `PlayerChips`; якщо гравців 0 — «Чекаємо на гравців…» | «Почати гру», неактивна при 0 гравців |
   | `HostQuestion` | «Питання 2 з 10»; текст питання; `TimerBar`; `OptionList` (`stage`, усі `idle`); «Відповіли: 12 з 20» | «Завершити питання» (другорядна) |
   | `HostReveal` | «Питання 2 з 10»; текст питання; `AnswerBars`; `OptionList`: правильний `correct`, решта `dimmed` | «Далі» |
   | `HostLeaderboard` | «Таблиця лідерів»; `LeaderboardList` — топ-5 з `showDelta` | «Наступне питання» |
   | `HostFinished` | «Гру завершено!»; `Podium`; `LeaderboardList` — усі гравці, прокрутка всередині списку | «До списку квізів» (посилання, передається як `onExit`) |

   У «Відповіли: N з M» N — це `answeredCount`, M — `players.length` (усі гравці, разом із відключеними: так N ніколи не перевищить M).
6. **Галерея** (`DevGalleryPage`): ліворуч навігація з групами «UI-кіт», «Ведучий», «Гравець»; вибраний екран — у параметрі `?screen=<група>/<ключ>` (наприклад `ui/kit`, `host/question-4`, `player/reveal-wrong`; ключі фікстур ведучого і гравця збігаються, тому група обовʼязкова). Екрани ведучого показуються в рамці 16:9, масштабованій під вікно; екрани гравця (з B3) — у рамці телефона 390×844. Для фікстур у фазі `question` галерея в момент вибору підставляє `serverNow = Date.now()` і `endsAt = Date.now() + timeLimitSec * 1000`, щоб таймер ішов. `onNext` і подібні колбеки пишуть у `console.info`. Перемикач «на весь екран» показує екран без рамки на всю сторінку.

**Поза межами етапу:** екрани гравця (B3), сокети, сторінки `HostGamePage`/`PlayerGamePage`.

**Acceptance criteria:**

- **B2-AC1.** `npm run typecheck`, `npm test`, `npm run build` зелені; `states.test.ts` перевіряє всі фікстури.
- **B2-AC2.** Кожна з 12 фікстур ведучого відкривається в `/dev` без помилок і попереджень у консолі (зокрема без попереджень React про `key`).
- **B2-AC3.** У режимі «на весь екран» при 1280×720 і 1920×1080 жоден екран ведучого не має скролу сторінки, нічого не обрізано і не виходить за межі — включно з `lobby-full`, `question-long`, `finished-many`.
- **B2-AC4.** На `question-*` таймер іде: число секунд зменшується, смуга плавно скорочується, на нулі зупиняється на `0` і не стає відʼємною; при ≤ 5 с змінює колір.
- **B2-AC5.** `OptionList` у `stage` коректно розкладає 2, 3 і 4 варіанти; літери A–D і кольори відповідають індексу.
- **B2-AC6.** `reveal-4`: висоти стовпчиків пропорційні 3 / 9 / 2 / 6, числа підписані, правильний варіант виділено і в стовпчиках, і в плитках. `reveal-none`: нулі, без `NaN` і помилок.
- **B2-AC7.** `finished-two`: пʼєдестал показує два місця без порожніх «undefined»; `finished-many`: пʼєдестал з трьох і повний список із 12.
- **B2-AC8.** `lobby-empty`: кнопка «Почати гру» неактивна; `lobby-few`: відключений гравець візуально відрізняється.
- **B2-AC9.** Правило шарів: `grep -RnE "lib/socket|lib/api|react-router" client/src/screens client/src/components` — порожньо.
- **B2-AC10.** У `*.module.css` немає «голих» кольорів: `grep -RnE "#[0-9a-fA-F]{3,8}\b" client/src --include=*.module.css` — порожньо (білий фон під QR задається змінною або в `tokens.css`).

**Перевірка:**

```bash
npm run typecheck && npm test && npm run build
grep -RnE "lib/socket|lib/api|react-router" client/src/screens client/src/components
grep -RnE "#[0-9a-fA-F]{3,8}\b" client/src --include=*.module.css
npm run dev:client      # /dev → пройти всі фікстури групи «Ведучий»
```

**Ручна перевірка:** пройти всі 12 фікстур на весь екран при 1280×720; відсканувати телефоном QR на `lobby-few` — телефон має запропонувати відкрити саме ту адресу, що підписана під кодом.

---

## Етап B3 — Екрани гравця (mobile-first)

**Мета:** усі шість екранів гравця намальовані для телефона й перевірені на фікстурах.

**Залежить від:** B2.

**Файли:** створити `components/game/PlayerHeader.tsx`, `screens/player/*`; доповнити `fixtures/states.ts` і `DevGalleryPage.tsx`.

**Вимоги:**

1. **`PlayerHeader`** — `name`, `score`: вузька смуга зверху з іменем ліворуч і балами праворуч (`formatScore`). Є на всіх екранах гравця, крім `PlayerLobby`.
2. **Фікстури гравця** (`playerFixtures`):

   | Ключ | Що перевіряє |
   |---|---|
   | `lobby` | очікування старту |
   | `question-4`, `question-2`, `question-3` | різна кількість варіантів |
   | `question-long` | питання 200 символів, варіанти по 80 |
   | `answered` | фаза `question`, `myAnswer: 2` |
   | `reveal-correct` | `lastResult: { correct: true, points: 850 }` |
   | `reveal-wrong` | відповів неправильно |
   | `reveal-timeout` | `myAnswer: null`, 0 балів |
   | `leaderboard-top` | гравець на 1-му місці, є в `top` |
   | `leaderboard-low` | гравець на 14-му місці, у `top` його немає |
   | `finished-winner` | 1-ше місце |
   | `finished-low` | 9-те місце з 12 |

3. **Екрани** (`screens/player/`), усі в `Screen variant="phone"`. Спільні props: `state: PlayerState`, `clockOffset: number`.

   | Екран | Коли | Вміст |
   |---|---|---|
   | `PlayerLobby` | `lobby` | «Ти в грі!»; імʼя великим; «Дивись на головний екран — гра ось-ось почнеться»; «Гравців у кімнаті: N» |
   | `PlayerQuestion` | `question`, відповіді ще немає | «Питання 2 з 10»; текст питання; `TimerBar`; `OptionList` (`phone`) з кнопками. Props: `onAnswer(index)`, `locked: boolean`. При `locked` кнопки неактивні й підпис «Час вийшов» |
   | `PlayerAnswered` | `question`, відповідь є | «Відповідь прийнято»; обрана плитка (`selected`); «Чекаємо на інших…» зі спінером. Props: `answerIndex: number` |
   | `PlayerReveal` | `reveal` | правильно: великий ✓, «Правильно!», `+850`; неправильно: ✗, «Неправильно», «Правильна відповідь: <текст>»; не відповів: «Час вийшов», «Правильна відповідь: <текст>». Фон картки — `--success` або `--danger` |
   | `PlayerLeaderboard` | `leaderboard` | «Ти на N місці»; бали; `LeaderboardList` з `top`, свій рядок підсвічено; якщо гравця немає в `top` — окремий рядок «N. Ти — бали» під списком |
   | `PlayerFinished` | `finished` | «Гру завершено!»; «Твоє місце: N з M»; бали; для 1–3 місця — медаль 🥇🥈🥉; кнопка «Грати ще» (props `onExit`) |

4. `PlayerQuestion`: плитки займають усю висоту, що лишилась після шапки, тексту питання й таймера; вертикального скролу сторінки немає. Довге питання зменшує шрифт або обрізається після 4 рядків, але не виштовхує кнопки за екран.
5. Галерея: група «Гравець» з усіма 13 фікстурами в рамці телефона; перемикач розміру рамки 360×640 / 390×844 / 430×932. Для `PlayerQuestion` галерея передає `locked: false`, а `onAnswer` пише в консоль; окремий пункт `player/question-4-locked` показує фікстуру `question-4` з `locked: true` (стан «Час вийшов»).

**Поза межами етапу:** сокети, сторінка `PlayerGamePage`, анімації (B6).

**Acceptance criteria:**

- **B3-AC1.** `npm run typecheck`, `npm test`, `npm run build` зелені; `states.test.ts` покриває й фікстури гравця.
- **B3-AC2.** Усі 13 фікстур гравця і пункт `player/question-4-locked` відкриваються в `/dev` без помилок і попереджень у консолі; у `question-4-locked` кнопки неактивні й видно «Час вийшов».
- **B3-AC3.** У рамках 360×640, 390×844 і 430×932 жоден екран гравця не має горизонтального скролу.
- **B3-AC4.** `question-4`, `question-2`, `question-3`, `question-long` при 360×640: усі кнопки варіантів видно повністю без прокручування, висота кожної ≥ 56px, текст не виходить за плитку.
- **B3-AC5.** Три варіанти `reveal-*` візуально різні й однозначні: колір, іконка, текст; у `reveal-wrong` і `reveal-timeout` показано текст правильної відповіді.
- **B3-AC6.** `leaderboard-top`: рядок гравця підсвічено в списку; `leaderboard-low`: під топ-5 є окремий рядок із 14-м місцем.
- **B3-AC7.** `finished-winner` показує 🥇; `finished-low` — «Твоє місце: 9 з 12» без медалі.
- **B3-AC8.** Правило шарів і «голих» кольорів досі виконується (ті самі `grep`, що в B2-AC9 і B2-AC10).

**Перевірка:**

```bash
npm run typecheck && npm test && npm run build
grep -RnE "lib/socket|lib/api|react-router" client/src/screens client/src/components
npm run dev:client      # /dev → група «Гравець», три розміри рамки
```

**Ручна перевірка:** відкрити `http://<LAN-IP>:5173/dev?screen=player/question-long` на справжньому телефоні в режимі «на весь екран»: кнопки зручно натискати великим пальцем, нічого не ховається під панеллю браузера.

---

## Етап B4 — Список і редактор квізів

**Мета:** ведучий може переглянути, створити, відредагувати й видалити квіз через інтерфейс.

**Залежить від:** B3 і **A1** (точка синхронізації SP1). Перевірка A1: при запущеному `npm run dev` команда `curl -s localhost:5173/api/quizzes` повертає JSON-масив із двома демо-квізами. Якщо ні — зупинись і повідом кодера A.

**Файли:** створити `lib/quizDraft.ts`, `lib/quizDraft.test.ts`; переписати `pages/QuizListPage.tsx`, `pages/QuizEditorPage.tsx`; за потреби додати компоненти в `components/ui/`.

**Вимоги:**

1. **`lib/quizDraft.ts`** — чисті функції над чернеткою:

   ```ts
   export type DraftQuestion = Question & { key: string };          // key — для React, на сервер не йде
   export interface QuizDraft { title: string; questions: DraftQuestion[] }

   export function emptyDraft(): QuizDraft;                         // назва '', одне типове питання
   export function draftFromQuiz(quiz: Quiz): QuizDraft;
   export function toQuizInput(draft: QuizDraft): QuizInput;        // без key
   export function addQuestion(draft: QuizDraft): QuizDraft;
   export function removeQuestion(draft: QuizDraft, key: string): QuizDraft;
   export function moveQuestion(draft: QuizDraft, key: string, direction: -1 | 1): QuizDraft;
   export function updateQuestion(draft: QuizDraft, key: string, patch: Partial<Question>): QuizDraft;
   export function addOption(draft: QuizDraft, key: string): QuizDraft;
   export function removeOption(draft: QuizDraft, key: string, optionIndex: number): QuizDraft;
   ```

   - Усі функції повертають новий обʼєкт і не змінюють аргумент.
   - Типове питання: `text: ''`, 4 порожні варіанти, `correctIndex: 0`, `timeLimitSec: DEFAULT_TIME_LIMIT_SEC`.
   - `addOption` не додає понад `MAX_OPTIONS`; `removeOption` не лишає менше `MIN_OPTIONS`.
   - `removeOption` виправляє `correctIndex`: видалено варіант перед правильним → `correctIndex − 1`; видалено сам правильний → `0`.
   - `moveQuestion` за межі списку нічого не змінює.
2. **`QuizListPage`** (`/quizzes`, `Screen variant="page"`):
   - шапка: `Logo`, кнопка «Створити квіз» → `/quizzes/new`, посилання «Вхід для гравців» → `/`;
   - стани: завантаження (`Spinner`); помилка (`Notice` + «Спробувати ще»); порожньо («Квізів ще немає» + кнопка створення);
   - картка квізу: назва, «N питань» (через `plural`), дата оновлення (`toLocaleDateString('uk-UA')`), кнопки «Запустити», «Редагувати» → `/quizzes/:id`, «Видалити»;
   - «Видалити»: `window.confirm('Видалити квіз «…»?')` → `deleteQuiz` → картка зникає без перезавантаження; помилка → `Notice`;
   - «Запустити» на цьому етапі є, але неактивна з підказкою «Зʼявиться на етапі B5».
3. **`QuizEditorPage`** (`/quizzes/new` і `/quizzes/:quizId`):
   - для наявного квізу — завантаження через `getQuiz`; 404 → `Notice` «Квіз не знайдено» + посилання на список;
   - поле «Назва квізу» (`maxLength={MAX_TITLE_LENGTH}`);
   - картка кожного питання: номер; `textarea` «Текст питання» (`maxLength={MAX_QUESTION_LENGTH}`); рядки варіантів — кольоровий бейдж-літера, поле тексту (`maxLength={MAX_OPTION_LENGTH}`), радіокнопка «правильна», кнопка видалення варіанта (схована, коли варіантів 2); «+ Додати варіант» (схована, коли їх 4); `select` «Час на відповідь» з `TIME_LIMIT_CHOICES` («20 секунд»); кнопки «↑», «↓», «Видалити питання» (неактивна, якщо питання одне);
   - «+ Додати питання» додає картку в кінець і прокручує до неї;
   - нижня панель, закріплена до низу вікна: «Скасувати» і «Зберегти»;
   - **«Зберегти»**: `validateQuizInput(toQuizInput(draft))`; є помилки → список у `Notice` над формою, прокрутка вгору, запит не надсилається; немає → `createQuiz` або `updateQuiz`, кнопка в стані `loading`; успіх → перехід на `/quizzes`; відповідь 400 → показати `details`; помилка мережі → `Notice`, чернетка не губиться;
   - **«Скасувати»**: якщо чернетку змінено — `window.confirm('Вийти без збереження?')`.

**Поза межами етапу:** запуск гри (B5), перетягування питань мишею, імпорт/експорт, автозбереження.

**Acceptance criteria:**

- **B4-AC1.** `npm run typecheck`, `npm test`, `npm run build` зелені.
- **B4-AC2.** Тести `quizDraft`: кожна функція не мутує аргумент; `emptyDraft` дає одне типове питання; `toQuizInput` не містить `key`; `addOption` зупиняється на 4, `removeOption` — на 2; `removeOption` коригує `correctIndex` в обох випадках; `moveQuestion` на межах; `draftFromQuiz → toQuizInput` повертає вихідні `title` і `questions`.
- **B4-AC3.** `/quizzes` показує два демо-квізи з правильною кількістю питань і формою слова («6 питань», «5 питань»).
- **B4-AC4.** Створення: `/quizzes/new` → заповнити назву й одне питання → «Зберегти» → перехід на список, новий квіз перший у списку; після перезавантаження сторінки він на місці.
- **B4-AC5.** Редагування: відкрити демо-квіз → усі поля заповнені збереженими значеннями, правильний варіант позначено → змінити назву й правильний варіант → «Зберегти» → відкрити знову: зміни збережено.
- **B4-AC6.** Валідація: «Зберегти» з порожньою назвою й порожнім питанням показує список помилок українською, запит на сервер не йде (перевірити у вкладці Network).
- **B4-AC7.** Видалення варіанта, що стояв перед правильним, не змінює того, **який текст** позначено правильним.
- **B4-AC8.** Видалення квізу: після підтвердження картка зникає; після перезавантаження її немає; скасування `confirm` нічого не видаляє.
- **B4-AC9.** При зупиненому сервері `/quizzes` показує `Notice` з помилкою і кнопкою «Спробувати ще», а не білий екран; після запуску сервера кнопка завантажує список.
- **B4-AC10.** `/quizzes/немає-такого` показує «Квіз не знайдено» з посиланням на список.
- **B4-AC11.** «Скасувати» зі зміненою чернеткою питає підтвердження; з незміненою — виходить одразу.
- **B4-AC12.** На ширині 1280px редактор не має горизонтального скролу; нижня панель завжди видима.

**Перевірка:**

```bash
npm run typecheck && npm test && npm run build
npm run dev             # /quizzes → створити, відредагувати, видалити
curl -s localhost:3001/api/quizzes     # звірити зі списком на екрані
```

**Ручна перевірка:** створити квіз із 3 питань (2, 3 і 4 варіанти), зберегти, відкрити знову й переконатись, що все на місці.

---

## Етап B5 — Realtime: хуки, вхід, сторінки гри

**Мета:** повна гра в браузері проти справжнього сервера: ведучий запускає квіз, гравці входять і грають, усе переживає оновлення сторінки й обрив звʼязку.

**Залежить від:** B4 і **A3** (точка синхронізації SP2); бажано A4 (боти). Перевірка A3: у `main` є `server/src/game/engine.ts` з функцією `advance`, і `npm run smoke` друкує `SMOKE OK`. Якщо ні — зупинись і повідом кодера A.

**Файли:** створити `hooks/useHostRoom.ts`, `hooks/usePlayerRoom.ts`, `components/game/ConnectionBanner.tsx`; переписати `pages/JoinPage.tsx`, `pages/HostGamePage.tsx`, `pages/PlayerGamePage.tsx`; змінити `pages/QuizListPage.tsx`.

**Вимоги:**

1. **Загальний шаблон підписки** (однаковий в обох хуках, G5 і G9):

   ```ts
   useEffect(() => {
     const join = () => socket.emit('host:join', { pin }, (res) => { if (!res.ok) setError(res.error); });
     socket.on('host:state', onState);
     socket.on('room:closed', onClosed);
     socket.on('connect', join);          // спрацьовує і при кожному перепідключенні
     if (socket.connected) join();
     return () => {
       socket.off('host:state', onState);
       socket.off('room:closed', onClosed);
       socket.off('connect', join);
     };
   }, [pin]);
   ```

   `onState` ігнорує знімки з чужим `pin` і зберігає пару `{ state, clockOffset: state.serverNow - Date.now() }`.
2. **`useHostRoom(pin)`** → `{ state: HostState | null, clockOffset, error: ErrorCode | null, closed: boolean, busy: boolean, next: () => void }`.
   - `next()`: якщо `busy` — нічого; інакше `busy = true`, `socket.timeout(5000).emit('host:next', (err, res) => …)`; після відповіді або таймауту `busy = false` (G13). Помилку з ack показувати через `Notice`.
3. **`usePlayerRoom(pin)`** → `{ status: 'needs-join' | 'ready', state: PlayerState | null, clockOffset, error, closed, pendingAnswer: number | null, answer: (index: number) => void }`.
   - Сесії немає або `session.pin !== pin` → `status: 'needs-join'` (сторінка перенаправить на `/?pin=<pin>`).
   - `join` надсилає `player:join` з `pin`, `name`, `playerId` із сесії.
   - `answer(index)`: якщо відповідь уже є або триває — нічого; інакше `pendingAnswer = index` **одразу** (оптимістичне блокування, R6), далі `player:answer`. Помилка в ack, крім `ALREADY_ANSWERED`, → `pendingAnswer = null`. `pendingAnswer` скидається, коли змінюється `state.questionIndex`.
   - Ефективна відповідь для екранів: `state.myAnswer ?? pendingAnswer`.
   - Помилка `ROOM_NOT_FOUND` → `clearSession()`.
4. **`JoinPage`** (`/`, `Screen variant="phone"`):
   - `Logo`; поле «Код гри» — тільки цифри, `maxLength={6}`, `inputMode="numeric"`, `autoComplete="off"`, початкове значення з `?pin=`; поле «Твоє імʼя» — `maxLength={MAX_NAME_LENGTH}`, початкове значення з останньої сесії; якщо PIN підставлено з адреси — фокус одразу на імені;
   - кнопка «Приєднатися» активна, коли `isValidPin(pin) && isValidPlayerName(name)`;
   - надсилання: `playerId` — із сесії або `createId()`; `socket.timeout(5000).emit('player:join', …)`; успіх → `saveSession` → перехід на `/play/<pin>`; помилка → `Notice` з `ERROR_MESSAGES[code]`; таймаут → «Сервер не відповідає»;
   - унизу посилання «Я ведучий →» на `/quizzes`.
5. **`PlayerGamePage`** (`/play/:pin`): `status === 'needs-join'` → `<Navigate to={'/?pin=' + pin} replace />`. Вибір екрана:

   | Умова | Екран |
   |---|---|
   | `closed` або помилка | картка «Гру завершено» / текст помилки + кнопка «На головну» |
   | `state === null` | `Spinner` «Підключаємось…» |
   | `lobby` | `PlayerLobby` |
   | `question`, ефективна відповідь є | `PlayerAnswered` |
   | `question`, відповіді немає | `PlayerQuestion`, `locked = remainingMs === 0` (сторінка сама викликає `useCountdown`) |
   | `reveal` / `leaderboard` / `finished` | відповідний екран |

   «Грати ще» на `PlayerFinished` → `clearSession()` і перехід на `/`.
6. **`HostGamePage`** (`/host/:pin`): `useHostRoom`; один раз `getConfig()` → `buildJoinUrl(pin, lanIp)` (помилка запиту → `lanIp = null`); вибір екрана за `state.phase`; будь-яка помилка `host:join` (зокрема `ROOM_NOT_FOUND`) або `closed` → картка «Гру не знайдено» + кнопка «До списку квізів»; `onExit` на `HostFinished` → `/quizzes`.
7. **`ConnectionBanner`**: коли `useConnection()` повертає `false` довше 1 с — смуга зверху «Зʼєднання втрачено. Перепідключаємось…». Підключається на `HostGamePage`, `PlayerGamePage`, `JoinPage`.
8. **Запуск гри** з `QuizListPage`: «Запустити» → `socket.timeout(5000).emit('host:create', { quizId }, …)` → успіх: перехід на `/host/<pin>`; помилка: `Notice`. Кнопка в стані `loading` до відповіді.

**Поза межами етапу:** анімації, керування з клавіатури, вібрація, конфеті (B6).

**Acceptance criteria:**

- **B5-AC1.** `npm run typecheck`, `npm test`, `npm run build` зелені.
- **B5-AC2.** Повна гра в трьох вкладках (ведучий + два гравці з різними іменами): усі фази проходять до `finished`; екрани на всіх вкладках перемикаються одразу після дії ведучого; фінальні бали у гравців збігаються з таблицею ведучого.
- **B5-AC3.** Гра з ботами: `npm run bots -- --pin <PIN> --count 10` → боти зʼявляються в лобі ведучого, лічильник «Відповіли» росте, гра доходить до фіналу.
- **B5-AC4.** Гра з авто-ведучим: `npm run bots -- --autohost --count 5 --lobby-wait 30` → зайти гравцем за надрукованим PIN і дограти: кожен екран гравця відповідає фазі.
- **B5-AC5.** Оновлення вкладки гравця у фазах `lobby`, `question` до відповіді, `question` після відповіді, `reveal`, `leaderboard`, `finished` повертає той самий екран із тими самими балами.
- **B5-AC6.** Оновлення вкладки ведучого в кожній фазі повертає той самий екран; у `question` таймер продовжує з поточного значення, а не починає спочатку.
- **B5-AC7.** Помилки входу: неіснуючий PIN → «Гру з таким кодом не знайдено»; імʼя вже зайняте підключеним гравцем → відповідний текст; порожнє імʼя або PIN із 5 цифр → кнопка неактивна.
- **B5-AC8.** `/play/123456` без сесії → перенаправлення на `/?pin=123456` з підставленим кодом. `/host/999999` (кімнати немає) → «Гру не знайдено» з кнопкою на список.
- **B5-AC9.** Відповідь гравця: кнопки блокуються миттєво, зʼявляється «Відповідь прийнято», другий тап неможливий; у `reveal` результат збігається з `lastResult`.
- **B5-AC10.** Гравець, який не відповів до нуля на таймері, бачить неактивні кнопки й «Час вийшов», а після `reveal` — екран «Час вийшов» із правильною відповіддю.
- **B5-AC11.** Подвійний швидкий клік по «Далі» перемикає рівно одну фазу.
- **B5-AC12.** Таймер у вкладках ведучого і гравця розходиться не більше ніж на 1 с.
- **B5-AC13.** Дві вкладки гравців в одному браузері — два різні гравці (G6).
- **B5-AC14.** Зупинка сервера під час гри: на всіх вкладках за кілька секунд зʼявляється банер про втрату звʼязку; після запуску сервера вкладки показують «Гру не знайдено» / «Гру завершено» з кнопкою, без білого екрана й неперехоплених помилок у консолі.
- **B5-AC15.** Немає витоку підписок: після кількох переходів `/quizzes` ↔ `/host/<pin>` у консолі браузера `socket.listeners('host:state').length` дорівнює `1` (для перевірки тимчасово виставити сокет у `window`, потім прибрати).
- **B5-AC16.** Правило шарів досі виконується (той самий `grep`, що в B2-AC9).

**Перевірка:**

```bash
npm run typecheck && npm test && npm run build
grep -RnE "lib/socket|lib/api|react-router" client/src/screens client/src/components
npm run dev
npm run bots -- --autohost --count 5 --lobby-wait 30      # в іншому терміналі
```

**Ручна перевірка:** зіграти повну гру зі справжнього телефона через QR (B5-AC2 на реальному пристрої); заблокувати телефон на 15 с під час питання і розблокувати — гра продовжується сама.

---

## Етап B6 — Полірування і стійкість

**Мета:** застосунок виглядає і поводиться як готовий продукт для презентації.

**Залежить від:** B5.

**Файли:** точкові зміни в `client/src/**` і `client/index.html`.

**Вимоги:**

1. **Переходи між фазами.** Екран зʼявляється з короткою CSS-анімацією (≤ 250 мс). Рядки `LeaderboardList` зʼявляються по черзі. У блоці `@media (prefers-reduced-motion: reduce)` анімації вимкнені.
2. **Керування з клавіатури для ведучого.** `Space`, `Enter` або `→` на `HostGamePage` викликає `next()`. Ігнорувати `event.repeat` і натискання, коли фокус у полі вводу чи на кнопці. Блокування `busy` діє так само, як для кліку.
3. **Відгук на телефоні.** У `PlayerReveal` — `navigator.vibrate?.(…)` (один імпульс для правильної, два для неправильної); там, де API немає, нічого не відбувається.
4. **Фінал.** На `HostFinished` — просте конфеті засобами CSS (до 40 елементів, без бібліотек), яке не перекриває кнопки й вимикається при `prefers-reduced-motion`.
5. **Лобі ведучого.** Кнопка «Скопіювати посилання» поруч з адресою; якщо `navigator.clipboard` недоступний — кнопки немає.
6. **Заголовки вкладок і favicon.** `document.title` на кожній сторінці («QuizRoom — Вхід», «QuizRoom — 123 456»…). Favicon — вбудований SVG через `data:`-адресу в `index.html`.
7. **Аудит станів.** На кожній сторінці є осмислені стани завантаження, порожнього списку й помилки; ніде немає «undefined», «NaN», порожніх екранів.
8. **Прибирання.** Жодних `console.log`, `TODO`, закоментованого коду, невикористаних файлів і заглушок із попередніх етапів. `/dev` лишається (знадобиться на захисті), але посилань на нього в інтерфейсі немає.

**Поза межами етапу:** нові функції, зміни контракту, звуки, темна/світла тема.

**Acceptance criteria:**

- **B6-AC1.** `npm run typecheck`, `npm test`, `npm run build` зелені.
- **B6-AC2.** `grep -RnE "console\.log|TODO|FIXME" client/src` — порожньо.
- **B6-AC3.** Перемикання фаз супроводжується анімацією; з увімкненим у системі «зменшити рух» анімацій і конфеті немає.
- **B6-AC4.** `Space`, `Enter` і `→` перемикають фазу на екрані ведучого; утримання клавіші перемикає рівно одну фазу.
- **B6-AC5.** Повна гра з 12 ботами проходить без помилок і попереджень у консолі браузера на вкладках ведучого і гравця.
- **B6-AC6.** Усі AC з B5 досі виконуються (повторити B5-AC2, AC5, AC6, AC11, AC14).
- **B6-AC7.** Усі фікстури в `/dev` досі відкриваються без помилок (B2-AC2, B3-AC2).
- **B6-AC8.** Правила шарів, «голих» кольорів і зовнішніх адрес досі виконуються (`grep` з B1-AC9, B1-AC10, B2-AC9, B2-AC10).
- **B6-AC9.** Розмір зібраного JS (`client/dist/assets/*.js`) не перевищує 500 КБ без стиснення.

**Перевірка:**

```bash
npm run typecheck && npm test && npm run build
grep -RnE "console\.log|TODO|FIXME" client/src
grep -RnE "randomUUID|localStorage|100vh" client/src client/index.html
grep -RnE "lib/socket|lib/api|react-router" client/src/screens client/src/components
ls -l client/dist/assets/
```

**Ручна перевірка:** повна гра на проєкторі (або зовнішньому моніторі) і двох телефонах; оцінити читабельність з відстані 5–6 метрів.
