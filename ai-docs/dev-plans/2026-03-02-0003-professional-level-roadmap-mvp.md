# План: Доведение MVP до профессионального уровня (этапный roadmap)

## Цель
Сформировать и выполнить минимально-рискованный roadmap, который поднимет текущий MVP до профессионального уровня по четырем осям: надежность, безопасность, тестируемость и эксплуатационная готовность — без потери текущего пользовательского флоу `login -> repo/branch -> deploy links`.

## Ограничения
- Текущий runtime и стек: Next.js + NextAuth + GitHub API.
- На первом этапе сохраняем текущую MVP-архитектуру (без БД/воркеров), чтобы быстро улучшить качество без большого инфраструктурного скачка.
- Изменения должны быть инкрементальными, с контрольными точками и возможностью отката.

## Тип задачи + уверенность
- Смешанный пакет: `feature` + `hardening` + `quality` (уверенность: средне-высокая).
- Почему: есть новая функциональность (preset), плюс обязательные инженерные улучшения для production-ready качества.

## Факты (подтверждено)
- Dashboard уже имеет advanced settings и строит deploy URL из этих полей:
  - `oneclickdeploy/src/components/dashboard/deploy-dashboard.tsx`
  - `oneclickdeploy/src/lib/deploy-links.ts`
- В проекте пока нет реализации preset/localStorage.
- В auth сейчас `accessToken` пробрасывается в session:
  - `oneclickdeploy/src/lib/auth.ts`
- GitHub API route handlers не обернуты в полноценную сетевую защиту (`try/catch` + timeout budget).
- В `package.json` нет тестового скрипта/фреймворка.
- Есть рассинхрон между текущим MVP и расширенным deployment-документом:
  - `oneclickdeploy/README.md` (MVP)
  - `oneclickdeploy/docs/deploy.md` (расширенная topology с DB/worker).

## Scope

### In scope (Этап A: без расширения архитектуры)
1. Реализовать локальный preset (1 слот, localStorage) для advanced settings.
2. Укрепить auth-границы (не светить токен в клиентской session-модели).
3. Добавить fail-fast проверку обязательных env для auth.
4. Укрепить GitHub API handlers: обработка сетевых сбоев, timeout, унифицированные ошибки.
5. Добавить базовую валидацию входных параметров и env-полей.
6. Добавить pagination/caching стратегию для списков repos/branches.
7. Ввести минимальный тестовый и CI-контур (lint/typecheck/test/build).

### Out of scope (Этап B: требует архитектурного расширения)
- Persisted presets между устройствами/пользователями (нужна БД).
- Server-side orchestration деплоя, очереди, webhooks, worker-процессы.
- Полный production-ops стек (централизованный мониторинг/алертинг/SLO dashboard).

## Предлагаемые изменения (change inventory)

### A1. Локальный preset (новая функция)
- `oneclickdeploy/src/components/dashboard/deploy-dashboard.tsx`
  - Кнопки `Save preset`, `Load preset`, `Clear preset`.
  - Неблокирующий статус операции.
- `oneclickdeploy/src/lib/deploy-preset.ts` (новый)
  - Тип `DeployPresetV1`.
  - `save/load/clear` с безопасным parse и shape-check.

### A2. Безопасность auth и конфигурации
- `oneclickdeploy/src/lib/auth.ts`
  - Убрать передачу `accessToken` в объект session на клиент.
  - Добавить явную проверку обязательных env (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `NEXTAUTH_SECRET`).
- `oneclickdeploy/src/types/next-auth.d.ts`
  - Актуализировать типы session/JWT под новую границу токена.

### A3. Надежность GitHub API-слоя
- `oneclickdeploy/src/app/api/github/repos/route.ts`
- `oneclickdeploy/src/app/api/github/branches/route.ts`
  - `try/catch` вокруг сетевых вызовов и JSON parse.
  - Timeout budget через `AbortController`.
  - Единый error envelope для UI.
  - Базовая валидация query параметров.

### A4. Масштабируемость и UX списков
- `oneclickdeploy/src/app/api/github/repos/route.ts`
- `oneclickdeploy/src/app/api/github/branches/route.ts`
- `oneclickdeploy/src/components/dashboard/deploy-dashboard.tsx`
  - Pagination strategy (как минимум контролируемая постраничная подгрузка).
  - Умеренный cache window + ручной refresh.

### A5. Тесты и quality gates
- `oneclickdeploy/package.json`
  - Добавить `test`/`test:ci` scripts.
- `oneclickdeploy/src/lib/deploy-links.ts`
  - Unit tests на edge-cases URL-генерации.
- `oneclickdeploy/src/app/api/github/*`
  - Контрактные тесты на статусы 200/401/403/404/429/502.
- `.github/workflows/*` (новый)
  - CI: lint + typecheck + test + build.

### A6. Документация и операционная чистота
- `oneclickdeploy/docs/deploy.md`
- `oneclickdeploy/README.md`
  - Явно развести «текущий MVP deployment» и «целевая расширенная topology».
  - Убрать операционный шум, который нельзя выполнить в текущем коде.

## Порядок выполнения (с stop-points)
1. **A1 Preset** (фича с минимальным риском) — stop-point: ручной smoke пройден.
2. **A2 Auth/Env hardening** — stop-point: логин стабилен, токен не доступен в клиентской session.
3. **A3 API resilience** — stop-point: ошибки сети/таймаутов отрабатываются предсказуемо.
4. **A4 Pagination/Caching** — stop-point: большие аккаунты обслуживаются без деградации UX.
5. **A5 Tests + CI** — stop-point: pipeline зеленый.
6. **A6 Docs cleanup** — stop-point: runbook соответствует реальному состоянию кода.

## Проверка

### Быстрые сигналы
- Preset сохраняется/восстанавливается после reload.
- Флоу login -> dashboard -> deploy links не регрессирует.
- Ошибки GitHub API отображаются контролируемо.

### Регресс-минимум
- `npm run lint`
- `npm run typecheck`
- `npm run test` (после добавления)
- `npm run build`

### Acceptance criteria уровня «профессионально» для Этапа A
1. Нет критичных утечек токена в клиентские структуры session.
2. Любая внешняя GitHub-операция имеет timeout и контролируемую ошибку.
3. Добавлены автоматические тесты для ключевых путей URL/API.
4. CI блокирует merge при падении quality gates.
5. Документация deployment не противоречит фактической архитектуре.

## Риски
- Риск: случайная регрессия auth при изменении token/session границы.
  - Митигируем: поэтапный rollout + обязательный smoke login.
- Риск: over-engineering до завершения базового hardening.
  - Митигируем: жесткая последовательность A1 -> A6, без параллельного расширения scope.
- Риск: частичная реализация тестов без CI enforcement.
  - Митигируем: тесты считаются завершенными только после включения в workflow.

## Rollout / rollback
- Rollout: маленькими PR по одному подэтапу A1..A6.
- Rollback: откат по файлам конкретного подэтапа без затрагивания остальных улучшений.

## Открытые вопросы
- Когда запускать Этап B (DB/worker/webhooks): сразу после A6 или отдельным roadmap?
- Нужен ли целевой SLO для API `/api/github/*` уже на MVP-стадии?

## Примечание по внешней валидации
- Инструмент Context7 в текущем окружении недоступен; решения в плане основаны на проверяемых фактах репозитория и read-only аудите.
