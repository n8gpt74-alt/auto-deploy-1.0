# План восстановления GitHub + Vercel после неудачной попытки

## Цель
Восстановить стабильный процесс доставки для проекта:
1) успешно обновить GitHub (`main` -> `origin/main`),
2) добиться зелёного CI в GitHub Actions,
3) выполнить успешный деплой в Vercel.

## Факты
- `git status --short --branch` сейчас показывает `main...origin/main` и неотслеживаемую папку `.github/` в корне репозитория.
- Настроен remote: `origin https://github.com/n8gpt74-alt/auto-deploy-1.0.git`.
- CI workflow есть в `.github/workflows/ci.yml` и запускается из `working-directory: oneclickdeploy` с этапами `lint`, `typecheck`, `test`, `build`.
- Скрипты приложения есть в `oneclickdeploy/package.json`: `lint`, `typecheck`, `test:ci`, `build`.
- Инструкция по деплою есть в `oneclickdeploy/docs/deploy.md`.
- Обязательные runtime-переменные перечислены в `oneclickdeploy/.env.example`: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.

## Границы задачи
### В рамках задачи
- Проверить состояние локального репозитория и синхронизацию ветки.
- Проверить готовность CI относительно текущего workflow и доступных скриптов.
- Проверить prerequisites для Vercel: переменные окружения и OAuth callback URL.
- Пройти упорядоченную последовательность восстановления: локальная проверка -> обновление GitHub -> проверка CI -> повторный деплой Vercel -> smoke-проверка.

### Вне рамок задачи
- Любой рефакторинг или доработка фич, не нужные для восстановления push/CI/deploy.
- Архитектурные изменения из roadmap-раздела `oneclickdeploy/docs/deploy.md`.
- Переход на другую CI/CD-платформу.

## Предлагаемый план изменений
1. **Локальный preflight без изменений кода**
   - Подтвердить, что активная ветка — `main`, а состояние рабочего дерева ожидаемое.
   - Подтвердить, что quality gates запускаются из `oneclickdeploy`:
     - `npm ci`
     - `npm run lint`
     - `npm run typecheck`
     - `npm run test:ci`
     - `npm run build`

2. **Восстановление обновления GitHub**
   - При необходимости добавить и закоммитить ожидаемые изменения метаданных репозитория, в первую очередь `.github/workflows/ci.yml`, если файл действительно должен быть в репозитории.
   - Выполнить push `main` в `origin/main`.
   - Если push снова упадёт, классифицировать причину:
     - auth/permission,
     - branch protection,
     - non-fast-forward divergence.
   - Применить соответствующий безопасный сценарий исправления и повторить push.

3. **Проверка GitHub Actions**
   - Дождаться запуска CI для SHA, который был отправлен в GitHub.
   - Если CI упадёт, определить конкретный этап: `lint`, `typecheck`, `test` или `build`, и устранять только блокирующую причину.

4. **Повторный деплой в Vercel**
   - Проверить, что проект Vercel привязан к тому же GitHub-репозиторию и нужной ветке.
   - Проверить, что переменные окружения в Vercel соответствуют обязательному набору из `.env.example`.
   - Проверить GitHub OAuth callback URL:
     - `https://<your-domain>/api/auth/callback/github`
   - Запустить деплой с последнего успешного коммита в `main`.

5. **Smoke-проверка после деплоя**
   - Войти через GitHub.
   - Открыть dashboard.
   - Проверить загрузку репозиториев и веток.
   - Проверить открытие deploy-ссылок для Vercel/Netlify из dashboard.

## Затронутые интерфейсы и контракты
- GitHub remote-контракт: обновление `origin/main`.
- CI-контракт: `.github/workflows/ci.yml` и запуск quality gates на Node 20.
- OAuth-контракт: GitHub callback URL должен совпадать с доменом деплоя.
- Runtime-контракт: обязательные auth env vars должны быть заданы в окружении деплоя.

## Риски
- **Push блокируется правами или branch rules** -> CI и deploy не стартуют.
- **Локальная среда отличается от GitHub Actions** -> локально всё зелёное, а CI падает.
- **Неверные env vars в Vercel** -> сборка проходит, но авторизация ломается уже после деплоя.
- **Несовпадение OAuth callback URL** -> логин в production не работает.

## Проверка результата
- **Быстрый сигнал**: `git push` проходит, и новый commit виден в `main` на GitHub.
- **Регрессионный сигнал**: job `quality` в GitHub Actions зелёный для того же SHA.
- **Сигнал деплоя**: Vercel показывает статус `Ready` для того же SHA.
- **Функциональная проверка**: GitHub login и загрузка repo/branch в production работают.

## Rollout / rollback
- Rollout: обычный forward deploy из `main`.
- Rollback: повторный деплой последнего стабильного SHA в Vercel и возврат к его набору env vars.

## Открытые вопросы
- Пока нет точного текста прошлой ошибки `git push`.
- Пока нет точной стадии падения Vercel: install, build или runtime.
- Нужно отдельно подтвердить, что `.github/workflows/ci.yml` должен быть добавлен в текущий репозиторий.
