# План: как сделать oneclickdeploy более рабочим и дорогим продуктом

## Goal
Превратить текущий MVP oneclickdeploy из удобного генератора deploy-ссылок в продукт с более высокой ценностью, удержанием и потенциалом монетизации.

## Constraints
- Текущий продукт — это MVP без базы данных, очередей, воркеров и provider webhooks.
- Сейчас сервис умеет читать GitHub-репозитории/ветки и открывать deploy flow у внешних провайдеров, но не управляет деплоями серверно.
- Нужно минимизировать scope creep: сначала улучшения, которые опираются на уже существующую архитектуру и прямо увеличивают продуктовую ценность.

## Functional requirements
- Определить, какие улучшения дадут максимальный рост продуктовой ценности и willingness-to-pay.
- Разделить улучшения на быстрые (можно делать на текущем стекe) и стратегические (требуют архитектурного расширения).
- Привязать рекомендации к текущему коду и ограничениям репозитория.
- Выделить приоритетный порядок реализации, чтобы эволюция продукта была поэтапной и проверяемой.

## In scope
- Анализ текущих возможностей продукта по фактам из кода и документации.
- Формирование приоритетного roadmap: UX/value improvements, monetization enablers, architecture expansion.
- Определение конкретных модулей/файлов, которые будут затронуты следующими этапами.

## Out of scope
- Непосредственная реализация roadmap в этом прогоне.
- Изменение pricing model, billing provider и юридических условий — это отдельный бизнес-поток.
- Полный редизайн UI без привязки к росту ценности.

## Assumptions
- Целевая аудитория — разработчики и небольшие команды, которым нужен быстрый запуск деплоев из GitHub.
- Бизнес-цель — уйти от utility/MVP в сторону deployment workflow product.
- Под «дорогим продуктом» понимается более высокая воспринимаемая ценность и появление B2B/paid сценариев.

## Proposed change

### Текущее состояние продукта
Подтверждено по коду и docs:
- GitHub OAuth login и защищённый dashboard: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `middleware.ts`.
- Загрузка репозиториев и веток через GitHub API: `src/app/api/github/repos/route.ts`, `src/app/api/github/branches/route.ts`.
- Выбор repo/branch и advanced settings в UI: `src/components/dashboard/deploy-dashboard.tsx`.
- Генерация deploy-ссылок для Vercel / Netlify / Cloudflare: `src/lib/deploy-links.ts`.
- Локальный preset только в браузере: `src/lib/deploy-preset.ts`.
- В docs явно зафиксировано отсутствие DB/queue/worker/webhooks: `docs/deploy.md`.

### Приоритет 1 — сделать продукт более рабочим уже на текущем фундаменте

#### 1. Множественные server-backed presets/templates
Почему это важно:
- Сейчас preset только один и только в localStorage; это слабое удержание и почти нулевая командная ценность.
- Saved templates — первый шаг к paid UX: reusable deploy recipes.

Что добавить:
- Несколько шаблонов на пользователя.
- Название шаблона, описание, provider-specific defaults.
- Быстрое применение шаблона к выбранному repo/branch.

Затронет:
- `src/components/dashboard/deploy-dashboard.tsx`
- `src/lib/deploy-preset.ts` (замена или миграция)
- новые `src/app/api/presets/*`
- новый persistence layer

Ценность:
- высокий UX impact
- medium implementation cost
- хороший фундамент для monetization tiers

#### 2. Auto-detect конфигурации репозитория
Почему это важно:
- Сейчас root/build/output/env вводятся вручную, это повышает friction.
- Автоопределение делает продукт заметно «умнее» и профессиональнее.

Что добавить:
- Чтение `package.json`, `vercel.json`, `netlify.toml`, `wrangler.*`, workspace markers через GitHub API.
- Вывод рекомендованных значений: root directory, build command, output directory, framework label.

Затронет:
- `src/app/api/github/*` или новый `src/app/api/github/repo-config/*`
- `src/components/dashboard/deploy-dashboard.tsx`
- новый модуль анализа repo config

Ценность:
- высокий activation impact
- medium complexity

#### 3. Capability matrix и product honesty в UI
Почему это важно:
- Сейчас у провайдеров разная глубина поддержки: Vercel без branch, Cloudflare только Workers, Netlify без build/output query support.
- Явная матрица возможностей повышает доверие и снижает disappointment.

Что добавить:
- Таблицу/бейджи: branch support, env support, monorepo support, direct deploy vs external flow.
- Подсказки по ограничениям рядом с каждой кнопкой.

Затронет:
- `src/components/dashboard/deploy-dashboard.tsx`
- `src/lib/deploy-links.ts`
- `README.md`

Ценность:
- medium value
- low complexity

#### 4. Улучшение auth/onboarding friction
Почему это важно:
- Сейчас используется GitHub OAuth со scope `repo`, это может тормозить конверсию.
- Для дорогого продукта onboarding должен быть предсказуемым и менее пугающим.

Что добавить:
- Ясное объяснение, зачем нужен доступ.
- Режим read-only/public repos, если возможен по модели доступа.
- Улучшенный onboarding copy и empty states.

Затронет:
- `src/lib/auth.ts`
- `src/app/login/page.tsx`
- `src/app/page.tsx`

Ценность:
- medium-to-high conversion impact
- low-to-medium complexity

### Приоритет 2 — добавить то, за что реально платят

#### 5. Deploy history + recent runs + one-click re-run
Почему это важно:
- Сейчас после клика продукт теряет пользователя и не знает outcome.
- История действий превращает продукт из launch utility в рабочий инструмент.

Что добавить:
- Сохранение попыток деплоя: provider, repo, branch, config snapshot, timestamp, user.
- Список последних запусков.
- Повторный запуск по сохранённому конфигу.

Затронет:
- `src/components/dashboard/deploy-dashboard.tsx`
- новые `src/app/api/deployments/*`
- persistence layer / DB

Ценность:
- высокий retention impact
- high complexity

#### 6. Shared workspaces / team templates
Почему это важно:
- Single-user utility плохо монетизируется.
- Shared recipes, team defaults, shared history — естественный B2B upgrade path.

Что добавить:
- Workspace model.
- Общие шаблоны деплоя.
- Права доступа и ownership.

Затронет:
- `src/lib/auth.ts`
- новые `src/app/api/workspaces/*`
- dashboard UI
- DB schema

Ценность:
- очень высокий monetization impact
- high complexity

#### 7. Secure env/secrets management
Почему это важно:
- Сейчас env handling ограничен и частично небезопасен по UX-модели.
- Для production use и платных команд нужен secret-safe workflow.

Что добавить:
- Серверное хранение/шифрование секретов.
- Provider-specific sync вместо передачи чувствительных значений через URL.
- Разделение non-secret vars и secrets.

Затронет:
- `src/lib/deploy-links.ts`
- `src/components/dashboard/deploy-dashboard.tsx`
- новые `src/app/api/secrets/*`
- DB + encryption strategy

Ценность:
- очень высокий product trust impact
- high complexity

### Приоритет 3 — перейти от “link launcher” к “deployment platform”

#### 8. Server-side deployment orchestration
Почему это важно:
- Это главный скачок в ценности: не просто открыть страницу провайдера, а запускать/трекать deploy внутри продукта.
- Именно это переводит продукт в более дорогую категорию.

Что добавить:
- Провайдерные API integrations.
- Создание deployment/run на сервере.
- Очередь/worker для длинных процессов.
- Webhook-based status sync.

Затронет:
- `src/lib/deploy-links.ts` (рефакторинг в provider abstraction)
- новые `src/lib/providers/*`
- новые `src/app/api/deployments/*`
- worker/queue/webhook infrastructure
- `docs/deploy.md`

Ценность:
- максимальный upside
- максимальная complexity

## Decision criteria
- Рост perceived value для пользователя
- Monetization potential
- Fit с текущим кодом и минимальной архитектурной эволюцией
- Снижение friction в activation и retention

## Chosen approach + rationale
Рекомендуемый путь — трёхэтапный:
1. **Fast value layer:** presets, auto-detect, capability matrix, onboarding fixes.
2. **Sticky product layer:** history, team/shared templates, secrets.
3. **Platform layer:** orchestration, webhooks, retries, deployment state.

Почему так:
- даёт заметный прирост ценности уже на раннем этапе;
- снижает риск перепрыгнуть сразу в тяжёлую платформенную архитектуру;
- создаёт естественную лестницу от MVP к premium/B2B продукту.

## Trade-offs
- Быстрые UX-улучшения сами по себе не делают продукт платформой, но резко улучшают activation.
- Платные B2B-фичи требуют DB и auth model expansion, что увеличивает complexity.
- Orchestration даёт максимальную ценность, но без промежуточных шагов слишком дорог по реализации и риску.

## Affected areas
- UI: `src/components/dashboard/deploy-dashboard.tsx`, `src/app/page.tsx`, `src/app/login/page.tsx`
- Auth: `src/lib/auth.ts`, `src/lib/github-token.ts`
- Provider logic: `src/lib/deploy-links.ts`
- API layer: `src/app/api/github/*` + будущие `src/app/api/presets/*`, `src/app/api/deployments/*`, `src/app/api/secrets/*`, `src/app/api/workspaces/*`
- Docs/runbook: `README.md`, `docs/deploy.md`

## Risks
- Самый большой риск — построить сложную платформу до подтверждения, какие сценарии реально драйвят ценность.
- Второй риск — хранение секретов и командных данных без продуманной security-модели.
- Третий риск — provider integrations могут создать большой support burden.

## Mitigations
- Идти поэтапно и валидировать каждую ступень usage/retention-сигналами.
- До secret management не обещать secure env automation как core capability.
- Provider integrations начинать с одного провайдера и одного подтверждённого сценария.

## Verification
- Быстрый сигнал: улучшения должны уменьшить число ручных действий в основном flow (repo → branch → deploy).
- Продуктовый сигнал: появление repeat usage сценариев (saved templates / history / rerun).
- Архитектурный сигнал: новые слои изолированы по модулям и не ломают текущий GitHub browsing flow.

## Estimate range
Метод: rough three-phase estimation.

- Phase 1 (presets + auto-detect + capability matrix + onboarding): **3–6 дней**
- Phase 2 (history + shared templates + secrets foundation): **1–3 недели**
- Phase 3 (server-side orchestration + webhooks + retries): **3–6 недель**

Факторы, которые могут изменить оценку:
- выбор DB/auth model;
- глубина provider API integrations;
- требования к team/billing/security.

## Rollout / rollback
- Rollout: реализовывать по фазам, каждая фаза должна быть полезной сама по себе.
- Rollback: если platform-layer окажется слишком дорогим, продукт всё равно останется ценным как smart deploy workflow assistant.

## Open questions
- Что важнее для тебя сейчас: быстрее улучшить UX/retention или быстрее строить monetization/B2B foundation?
- Хочешь идти в сторону solo developer tool или team/workspace продукта?
- Нужен ли нам в ближайшем этапе реальный server-side deploy, или сначала достаточно умных шаблонов + истории?
