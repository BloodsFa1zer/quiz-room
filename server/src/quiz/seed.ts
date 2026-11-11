import type { QuizInput } from '@quiz/shared';

/** Demo quizzes written to the data file on the first start. */
export const SEED_QUIZZES: QuizInput[] = [
  {
    title: 'Веб-технології',
    questions: [
      {
        text: 'Що означає абревіатура HTTP?',
        options: [
          'HyperText Transfer Protocol',
          'High Transfer Text Process',
          'Hyperlink Text Transport Program',
          'Home Tool Transfer Protocol',
        ],
        correctIndex: 0,
        timeLimitSec: 20,
      },
      {
        text: 'Який код стану HTTP означає «Не знайдено»?',
        options: ['200', '301', '404', '500'],
        correctIndex: 2,
        timeLimitSec: 10,
      },
      {
        text: 'Чи може сервер через WebSocket сам надіслати повідомлення клієнту, без запиту від нього?',
        options: ['Так', 'Ні'],
        correctIndex: 0,
        timeLimitSec: 10,
      },
      {
        text: 'Яким HTTP-заголовком клієнт просить перейти із HTTP на WebSocket?',
        options: ['Accept', 'Cookie', 'Location', 'Upgrade'],
        correctIndex: 3,
        timeLimitSec: 20,
      },
      {
        text: 'Яка мова програмування вбудована в усі сучасні браузери?',
        options: ['Python', 'JavaScript', 'Java'],
        correctIndex: 1,
        timeLimitSec: 10,
      },
      {
        text: 'Що відбувається з типами TypeScript під час компіляції в JavaScript?',
        options: [
          'Перетворюються на перевірки під час виконання',
          'Видаляються',
          'Залишаються як коментарі',
          'Передаються браузеру для перевірки',
        ],
        correctIndex: 1,
        timeLimitSec: 20,
      },
    ],
  },
  {
    title: 'Загальна ерудиція',
    questions: [
      {
        text: 'Яка найбільша планета Сонячної системи?',
        options: ['Сатурн', 'Юпітер', 'Нептун', 'Земля'],
        correctIndex: 1,
        timeLimitSec: 10,
      },
      {
        text: 'Яке місто є столицею Японії?',
        options: ['Кіото', 'Осака', 'Токіо'],
        correctIndex: 2,
        timeLimitSec: 10,
      },
      {
        text: 'Місяць світиться власним світлом?',
        options: ['Так', 'Ні'],
        correctIndex: 1,
        timeLimitSec: 10,
      },
      {
        text: 'Хто автор збірки «Кобзар»?',
        options: ['Леся Українка', 'Іван Франко', 'Тарас Шевченко', 'Григорій Сковорода'],
        correctIndex: 2,
        timeLimitSec: 20,
      },
      {
        text: 'Який хімічний символ має золото?',
        options: ['Ag', 'Fe', 'Zn', 'Au'],
        correctIndex: 3,
        timeLimitSec: 20,
      },
    ],
  },
];
