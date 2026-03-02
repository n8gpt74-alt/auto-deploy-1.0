# План: MVP-фича «Локальный deploy preset» (без сервера)

## Цель
Добавить в dashboard возможность сохранить и повторно применить **один локальный preset** для advanced settings, чтобы ускорить повторные деплои без расширения backend-архитектуры.

## Тип задачи + уверенность
- `feature` (уверенность: высокая)
- Сигналы: новая пользовательская функциональность, явные критерии поведения, нет признаков багфикса/миграции.

## Факты (подтверждено)
- Dashboard уже содержит advanced fields: `rootDirectory`, `buildCommand`, `outputDirectory`, `envText` (`oneclickdeploy/src/components/dashboard/deploy-dashboard.tsx`).
- Текущая генерация deploy URL уже использует эти поля (`oneclickdeploy/src/lib/deploy-links.ts`).
- В кодовой базе нет текущей реализации preset/local storage (`grep` по `localStorage|preset` не нашел совпадений).
- По подтверждению пользователя на этот этап:
  - источник требований: `oneclickdeploy/docs/deploy.md`;
  - приоритет: «Новая фича MVP»;
  - объем preset: «1 локальный preset, без сервера»;
  - состав preset: «Только advanced settings».

## Ограничения
- Без БД/API/воркеров/очередей для preset на этом этапе.
- Минимальные изменения в существующем UI, без новых тяжелых зависимостей.
- Не меняем логику OAuth/GitHub API и построение deploy-ссылок.

## Scope

### In scope
- Сохранение одного preset в `localStorage`.
- Загрузка preset при открытии dashboard (только в клиентской среде).
- Действия в UI: `Save preset`, `Load preset`, `Clear preset`.
- Валидация/безопасный парсинг persisted данных (защита от битого JSON).

### Out of scope
- Несколько именованных preset.
- Серверное хранение preset и синхронизация между устройствами.
- Сохранение `repo`/`branch` в preset.

## Предлагаемые изменения

### Artifacts list
1. `oneclickdeploy/src/components/dashboard/deploy-dashboard.tsx`
2. `oneclickdeploy/src/lib/deploy-preset.ts` (новый модуль)

### Changes per artifact
1. `deploy-dashboard.tsx`
   - Добавить UI-кнопки управления preset рядом с advanced settings.
   - Добавить вызовы `save/load/clear` для advanced state-полей.
   - Добавить неблокирующее сообщение статуса (успех/ошибка восстановления preset).

2. `deploy-preset.ts` (новый)
   - Описать тип `DeployPresetV1` (только `rootDirectory`, `buildCommand`, `outputDirectory`, `envText`).
   - Реализовать маленькие чистые функции:
     - `saveDeployPreset(preset)`
     - `loadDeployPreset()`
     - `clearDeployPreset()`
   - Реализовать безопасный парсинг с `try/catch` и простую валидацию shape.

### Dependencies / order
1. Создать/подключить `deploy-preset.ts`.
2. Интегрировать в `deploy-dashboard.tsx` кнопки и обработчики.
3. Проверить ручной сценарий и регресс (`lint`, `typecheck`, `build`).

## Interfaces / contracts
- Новый локальный контракт хранения: ключ `localStorage` (например, `deploy-buttons:preset:v1`).
- Версионирование ключа (`v1`) обязательно, чтобы в будущем можно было безопасно менять формат.

## Data impact
- Только клиентское хранилище браузера (одна запись preset).
- Нет изменений в БД, API-контрактах и env-конфигурации.

## Regression hotspots
- Клиентский рендер dashboard (`use client`) и работа с состоянием формы.
- Поведение при поврежденных данных в `localStorage`.
- Существующая логика генерации deploy URL после загрузки preset.

## Критерии приемки
1. Пользователь может сохранить текущие advanced settings в preset.
2. После перезагрузки страницы preset можно загрузить и поля восстанавливаются корректно.
3. `Clear preset` удаляет сохранение и повторная загрузка не подставляет значения.
4. При битом JSON в `localStorage` UI не падает, показывается контролируемая ошибка/игнор.
5. Сформированные Vercel/Netlify URL после `Load preset` соответствуют восстановленным полям.

## Проверка

### Быстрый сигнал
- Сохранить preset -> перезагрузить страницу -> загрузить preset -> увидеть восстановленные поля.

### Регресс
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Smoke: убедиться, что кнопки деплоя по-прежнему открывают корректные URL.

## Риски
- Риск: поврежденный/ручной мусор в `localStorage`.
  - Митигируем: безопасный parse + fallback на пустой preset.
- Риск: нежелательная автоподстановка устаревших значений.
  - Митигируем: явная кнопка `Load preset` (без скрытого auto-apply).
- Риск: рост сложности компонента dashboard.
  - Митигируем: вынести storage-логику в `src/lib/deploy-preset.ts`.

## Rollout / rollback
- Rollout: включить кнопки preset сразу для всех пользователей (локальная фича без backend-рисков).
- Rollback: удалить новый модуль preset и связанный UI-блок в dashboard.

## Открытые вопросы
- Нужен ли auto-load preset при входе в dashboard в следующей итерации?
- Нужен ли импорт/экспорт preset (JSON) для переноса между браузерами?

## Примечание по внешней валидации
- Инструмент Context7 в данном окружении недоступен; решения в плане основаны на фактах из репозитория и ограничениях текущего MVP-этапа.
