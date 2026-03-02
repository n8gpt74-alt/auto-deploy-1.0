# План: Создание AGENTS.md для проекта Deploy Buttons

## Цель
Подготовить файл `AGENTS.md` с инструкциями для ИИ-агентов (таких как Antigravity, Cursor, Copilot), чтобы они могли эффективно работать в данном репозитории, соблюдая стандарты кода и используя правильные команды.

## Анализ проекта
- **Стек:** Next.js 16.1.6 (App Router), TypeScript, Tailwind CSS v4.
- **Основные команды:** `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`.
- **Архитектура:** App Router (`src/app`), компоненты (`src/components`), логика (`src/lib`).

## Содержимое AGENTS.md (Черновик)

```markdown
# Agentic Guidelines for Deploy Buttons (MVP)

This document provides essential technical context, code style guidelines, and command references for agentic coding assistants operating in this repository.

## Project Overview
- **Stack:** Next.js 16.1.6 (App Router), TypeScript, Tailwind CSS v4.
- **Purpose:** A minimal service for one-click deployment from GitHub to Vercel/Netlify.
- **Authentication:** NextAuth.js (Auth.js) with GitHub provider (JWT session, no DB).

## Command Reference

### Build and Development
- `npm run dev` - Starts the development server at http://localhost:3000.
- `npm run build` - Builds the application for production.
- `npm run start` - Runs the built application.

### Quality Control
- `npm run lint` - Runs ESLint for code quality and style checks.
- `npm run typecheck` - Runs the TypeScript compiler to check for type errors (`tsc --noEmit`).

### Testing
- **Note:** Currently, no automated testing framework (like Vitest or Jest) is configured in the `package.json`. 
- **Recommendation:** When adding tests, prefer Vitest and follow the pattern `**/*.test.{ts,tsx}`.

## Code Style and Conventions

### 1. File Structure and Naming
- **Directory Layout:**
  - `src/app/` - Next.js App Router (pages, layouts, and API routes).
  - `src/components/` - React components.
  - `src/components/ui/` - Low-level UI components (shadcn-like).
  - `src/lib/` - Shared utilities, auth configuration, and API clients.
  - `src/types/` - Global TypeScript type definitions.
- **Naming Conventions:**
  - Files: `kebab-case.tsx` (e.g., `deploy-dashboard.tsx`).
  - Components: `PascalCase` (e.g., `export function DeployDashboard()`).
  - Functions/Variables: `camelCase`.
  - Constants: `UPPER_SNAKE_CASE`.

### 2. Imports
- Use the `@/` alias to reference the `src/` directory.
- **Order:**
  1. React/Next.js core imports.
  2. External library imports.
  3. Internal utility/lib imports (`@/lib/...`).
  4. Component imports (`@/components/...`).
  5. Style/Asset imports.

### 3. Components
- **Client Components:** Use the `"use client";` directive at the top of the file for any component using hooks (useState, useEffect, etc.).
- **UI Components:** Use the `cn` utility from `@/lib/utils` for merging Tailwind classes safely.
- **Logic:** Keep business logic in `src/lib/` and keep components focused on rendering.

### 4. TypeScript
- **Strict Mode:** Always use strict typing. Avoid `any`.
- **Interfaces vs Types:** Use `type` for simple data shapes and `interface` for objects that might be extended.
- **API Types:** Define explicit types for API request bodies and responses (e.g., `type GitHubRepo = { ... }`).

### 5. Error Handling
- **API Routes:** Return descriptive error messages and appropriate HTTP status codes using `NextResponse.json`.
- **Async/Await:** Use `try/catch` blocks for asynchronous operations, especially when calling external APIs (GitHub).
- **Graceful Degradation:** Handle API failures (like rate limits or 401s) with user-friendly messages.

### 6. Styling
- **Tailwind CSS v4:** Use utility classes directly in the `className` prop.
- **CSS-in-JS:** Avoid. Use CSS modules or global CSS only if Tailwind is insufficient.

## External Integrations

### GitHub API
- API calls should be made from **Server Route Handlers** (`src/app/api/...`) to protect the `accessToken`.
- Use the `accessToken` from the NextAuth session for authorization.
- Always include the `X-GitHub-Api-Version: 2022-11-28` header.

### Deploy Links
- Implement deploy URL generation in `src/lib/deploy-links.ts`.
- Document which parameters are supported by Vercel vs. Netlify to avoid confusion.

## Workflow Rules
- **Minimalism:** This is an MVP. Avoid adding dependencies or complex abstractions unless strictly necessary.
- **Security:** Never log secrets, tokens, or sensitive user data.
- **Documentation:** Maintain `ai-docs/` for any significant architectural changes or new features.

## Cursor/Copilot Instructions
- This project follows the Next.js App Router conventions.
- When generating code, ensure accessibility (ARIA labels, keyboard navigation).
- Prefer functional components and hooks over class components.

---
*Created on 2026-03-02*
```

## Ограничения
Я нахожусь в режиме **Planning (Read-Only)**, поэтому я не могу напрямую создать файл `AGENTS.md` в корне репозитория.

## Следующие шаги
1. Пользователь должен скопировать содержимое черновика выше.
2. Создать файл `AGENTS.md` в корне проекта (или `oneclickdeploy/AGENTS.md`).
3. Вставить скопированное содержимое.
