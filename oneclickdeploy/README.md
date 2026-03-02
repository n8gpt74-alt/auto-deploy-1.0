# Deploy Buttons (MVP)

Minimal web service: login with GitHub, pick repository + branch, open one-click deploy flows:

- Deploy to Vercel
- Deploy to Netlify
- Deploy to Cloudflare (Workers Deploy Button)

Advanced settings are supported with local named templates, auto-recommendations from repository config, and provider capability hints.

## Stack

- Next.js (App Router) + TypeScript
- Auth.js (NextAuth) with GitHub Provider
- Tailwind CSS + shadcn-style UI components
- Node.js 18+

## Scope (MVP)

- No database
- No queues/workers
- No server-side Vercel/Netlify API calls
- No provider token storage
- GitHub OAuth is used only to read repos/branches

## Current MVP capabilities

- GitHub login and protected dashboard routes.
- Repository list with pagination (`Load more repositories`).
- Branch list with pagination (`Load more branches`).
- Advanced settings (root/build/output/env) included in deploy URL generation where supported.
- Local deploy templates in browser storage (multi-slot): save/load/delete/clear-all.
- Local deploy history (last 25 runs): provider/repo/branch/config snapshot + re-run link.
- Auto-recommendation endpoint for build config detection based on repository files (`/api/github/repo-config`).
- Provider capability matrix in dashboard (branch/build/env behavior visibility).

## Project structure

```txt
src/
  app/
    api/
      auth/[...nextauth]/route.ts
      github/
        repos/route.ts
        branches/route.ts
        repo-config/route.ts
    dashboard/page.tsx
    login/page.tsx
    logout/page.tsx
    page.tsx
    layout.tsx
    globals.css
  components/
    dashboard/deploy-dashboard.tsx
    ui/
      accordion.tsx
      button.tsx
      card.tsx
      input.tsx
      textarea.tsx
    providers.tsx
  lib/
    auth.ts
    deploy-history.ts
    deploy-links.ts
    utils.ts
  types/
    next-auth.d.ts
middleware.ts
.env.example
```

## Deploy URL strategy (A/B)

### Vercel

- **Chosen (A):** `https://vercel.com/new/clone?repository-url=...`
- Why: stable and widely used Deploy Button flow.
- Branch: not passed, because there is no reliable documented branch query parameter for this flow.

Optional params passed when provided:

- `root-directory`
- `build-command`
- `output-directory`
- `env` (keys only, no values)

If Vercel changes flow, update URL generation in `src/lib/deploy-links.ts` (`createVercelDeployUrl`).

### Netlify

- Flow: `https://app.netlify.com/start/deploy?repository=...`
- Branch is passed via query `branch`.
- Root directory is passed via query `base`.
- Env vars are passed in URL hash (`#KEY=VALUE&...`).
- Build command / output directory are not passed (not reliably supported as button query params).

If Netlify changes flow, update `src/lib/deploy-links.ts` (`createNetlifyDeployUrl`).

### Cloudflare

- Flow: `https://deploy.workers.cloudflare.com/?url=...`
- Current support in app: Cloudflare Workers Deploy Button flow.
- Current limitation: this is not a Cloudflare Pages deploy flow.

If Cloudflare changes flow, update `src/lib/deploy-links.ts` (`createCloudflareDeployUrl`).

## GitHub OAuth App setup

1. Open GitHub: **Settings -> Developer settings -> OAuth Apps -> New OAuth App**.
2. Fill fields:
   - Application name: `Deploy Buttons Local`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
3. Click **Register application**.
4. Copy `Client ID` and generate `Client secret`.
5. Put values into `.env.local` (see `.env.example`).

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Auth and security notes

- Protected routes:
  - `/dashboard/*`
  - `/api/github/*`
- GitHub API calls are made only on server route handlers.
- GitHub access token stays server-side in JWT and is not projected into client session data.
- Error states handled:
  - unauthorized token
  - no access to repository
  - GitHub rate limit
  - empty repository list

## Useful scripts

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## CI quality gates

GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

- lint
- typecheck
- tests
- production build
