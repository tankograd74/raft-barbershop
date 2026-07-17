# R. A. F. T — лендинг барбершопа

Сайт барбершопа **R. A. F. T** (Екатеринбург, ул. Бажова, 193). Дизайн из Figma Make, данные и фото — из карточки [Яндекс.Карт](https://yandex.ru/maps/org/r_a_f_t/84586990378/).

## Запуск

```bash
npm install
npx playwright install chromium   # нужно для npm run sync
npm run dev
```

Сборка: `npm run build` → `dist/`.

## GitHub Pages

Сайт публикуется в репозиторий `raft-barbershop` по адресу:

`https://<username>.github.io/raft-barbershop/`

Деплой идёт через GitHub Actions (`.github/workflows/deploy-pages.yml`) при пуше в `main`.

В настройках репозитория: **Settings → Pages → Source = GitHub Actions**.

## Данные

Единый источник для UI: [`public/data/site.json`](public/data/site.json).

Фото: [`public/photos/`](public/photos/).

Сырой дамп карточки: [`raft_barbershop_data/`](raft_barbershop_data/).

## Синхронизация с Яндекс.Картами

Раз в сутки (локально, без автодеплоя):

```bash
npm run sync
```

Скрипт открывает карточку организации, обновляет телефон, адрес, координаты, часы, рейтинг/отзывы и фото в `public/data/site.json` (+ новые файлы в `public/photos/`).

Пересобрать `site.json` из уже скачанного дампа без сети:

```bash
npm run seed
```

## Расписание

По карточке Яндекса: **Вт, Ср, Пт, Сб, Вс** 11:00–21:00; **Пн, Чт** — выходной.

## Запись

Форма «Записаться» по сабмиту открывает `tel:+79222129020`.
