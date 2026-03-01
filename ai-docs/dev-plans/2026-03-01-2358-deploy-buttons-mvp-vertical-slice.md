# План: Deploy Buttons MVP (вертикальный срез)

## Цель
Собрать минимальный рабочий сервис без БД и очередей: вход через GitHub OAuth, выбор репозитория и ветки, генерация двух рабочих кнопок деплоя (Vercel/Netlify) с честной передачей только поддерживаемых параметров.

## Тип задачи
- `feature` (уверенность: высокая)
- Сигналы: новая пользовательская функциональность и явные MVP-ограничения.

## Факты (подтверждено)
- Текущий проект уже на Next.js App Router + TypeScript (`next` 16.1.6), что совместимо с требованием 14+.
- Текущая авторизация использует Prisma adapter и DB session (`src/lib/auth.ts`), что конфликтует с ограничением "без БД".
- Текущий dashboard и API завязаны на Prisma/очередь (`src/app/dashboard/page.tsx`, `src/app/api/deploy/route.ts`, `src/lib/queue.ts`).
- Middleware для защиты маршрутов отсутствует.
- Официальный flow Netlify Deploy Button подтвержден: `https://app.netlify.com/start/deploy?repository=...`; в документации поддерживается `branch`.
- Для Vercel широко используется и документирован Deploy Button flow через `https://vercel.com/new/clone?...` с параметром `repository-url` и доп. параметрами (`project-name`, `root-directory`, `build-command`, `output-directory`, `env` и т.д.); надежного подтверждения параметра `branch` не найдено.

## Ограничения
- Без БД, без Prisma adapter, без Redis/BullMQ, без server-side API интеграции с Vercel/Netlify.
- Только GitHub OAuth и GitHub REST API с access token из session.
- Рабочий код без заглушек.
- Начинаем с вертикального среза: `login -> list repos -> select repo/branch -> 2 deploy buttons`.

## Требования и критерии приемки
1. Неавторизованный пользователь попадает на landing/login, авторизованный — на dashboard.
2. На dashboard загружается список репозиториев пользователя из GitHub API с поиском по названию.
3. После выбора репозитория загружаются ветки; по умолчанию выбирается `default_branch`.
4. Кнопка Vercel открывает экран импорта репозитория в Vercel.
5. Кнопка Netlify открывает `start/deploy` c `repository` (и `branch`, если указан).
6. Опциональные advanced settings не обязательны для запуска; при заполнении передаются только в поддерживаемые query/hash параметры.
7. Обрабатываются ошибки: нет доступа, rate limit, пустой список репозиториев.

## Scope

### In scope
- Упрощение auth до JWT session (без БД), хранение GitHub access token в callbacks.
- Страницы `/login`, `/logout`, `/dashboard`, landing.
- Middleware-защита для `/dashboard` и внутренних GitHub API route handlers.
- API-роуты для чтения репозиториев и веток GitHub.
- Генерация deploy URL для Vercel/Netlify.
- Базовый UI на Tailwind + shadcn/ui (кнопки, поля, accordion).
- Обновление `.env.example` и README (без prisma-инструкций).

### Out of scope
- Любые БД/миграции/Prisma.
- Очереди, фоновые воркеры, webhooks, хранение external project state.
- OAuth к Vercel/Netlify и вызовы их API.
- Автозапуск деплоя через backend — только redirect по ссылке.

## Выбор подхода (A/B)

### Критерии выбора
- Надежность официального flow.
- Соответствие ограничениям MVP.
- Минимальность реализации.

### Vercel: варианты
- **A (выбран):** `https://vercel.com/new/clone?repository-url=...` (+ поддерживаемые query параметры).
  - Плюсы: подтверждается Vercel Deploy Button docs и массовыми production примерами.
  - Минусы: надежного параметра `branch` нет; ветка выбирается пользователем в UI Vercel после перехода.
- **B (не выбран):** `https://vercel.com/new/import?s=...`.
  - Минус: слабее документирован для параметризации репозитория/настроек в стабильном виде.

### Netlify
- Используем `https://app.netlify.com/start/deploy?repository=...`.
- `branch` поддерживается и передается.

## Предлагаемые изменения (артефакты)
- `src/lib/auth.ts`
  - Убрать PrismaAdapter и зависимость от БД.
  - Перейти на JWT session strategy.
  - В `jwt` callback сохранить `accessToken` GitHub.
  - В `session` callback пробросить `accessToken` в session.
- `src/types/next-auth.d.ts`
  - Расширить `Session` типом `accessToken?: string` и `user.id`.
- `src/middleware.ts` (новый)
  - Защитить `/dashboard/:path*` и `/api/github/:path*`.
- `src/app/login/page.tsx` (новый)
  - Экран входа с `signIn("github")`.
- `src/app/logout/page.tsx` (новый)
  - Экран/кнопка выхода через `signOut`.
- `src/app/page.tsx`
  - Landing page c CTA на login/dashboard.
- `src/app/dashboard/page.tsx`
  - MVP-дашборд (или server wrapper + client component): выбор repo/branch, advanced settings, deploy buttons.
- `src/app/api/github/repos/route.ts` (новый)
  - GET к `https://api.github.com/user/repos?per_page=100&sort=updated`.
  - Нормализация ошибок: 401/403/429/прочие.
- `src/app/api/github/branches/route.ts` (новый)
  - GET к `https://api.github.com/repos/{owner}/{repo}/branches?per_page=100`.
- `src/lib/deploy-links.ts` (новый)
  - Чистые функции генерации Vercel/Netlify URL.
  - Явные комментарии по поддерживаемым/неподдерживаемым параметрам (особенно branch у Vercel).
- `src/components/ui/*` (новые/обновление)
  - Минимальный набор shadcn/ui: `button`, `input`, `textarea`, `accordion`, `card` (+ `src/lib/utils.ts` с `cn`).
- `.env.example`
  - Оставить только `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.
- `README.md`
  - Обновить setup под MVP без prisma и очередей.
  - Добавить инструкцию создания GitHub OAuth App.

## Порядок выполнения
1. Упростить auth и типы session/JWT.
2. Добавить middleware и страницы login/logout.
3. Реализовать API-роуты GitHub repos/branches.
4. Реализовать генератор deploy URL.
5. Собрать dashboard UI и связать с API.
6. Обновить `.env.example` и README.
7. Прогнать lint/build и smoke-проверку в браузере.

## Стратегия проверки

### Быстрый сигнал
- После логина виден dashboard и список репозиториев.

### Проверки по AC
- Пустой список репозиториев отображает явный empty-state.
- Выбор репозитория подгружает ветки, default_branch выбран автоматически.
- `Deploy to Vercel` открывает Vercel import flow с репозиторием.
- `Deploy to Netlify` открывает Netlify start/deploy с `repository` (+ `branch`, если выбран).
- Advanced settings:
  - если пусто, ссылки строятся без этих параметров;
  - если заполнено, параметры добавляются только где поддержаны.

### Регресс
- `npm run lint`
- `npm run build`
- Проверка middleware: прямой переход на `/dashboard` без сессии редиректит на `/login`.

## Риски и смягчение
- Риск: утечка токена в клиентский код.
  - Митигируем: GitHub API дергается только серверными route handlers, token не логируется.
- Риск: неоднозначность параметров Vercel URL.
  - Митигируем: использовать только подтвержденные параметры; branch не форсировать.
- Риск: GitHub rate limit/403.
  - Митигируем: явные пользовательские сообщения и retry-путь.

## Rollout / rollback
- Rollout: внедряем MVP-поток как основной путь (`/login` + `/dashboard`).
- Rollback: откат конкретного набора файлов (auth/dashboard/api/github/middleware) к предыдущему состоянию.

## Неопределенности
- Инструмент Context7 в текущем окружении недоступен; валидация внешних flow выполнена по официальной документации провайдеров и публичным production-репозиториям.
