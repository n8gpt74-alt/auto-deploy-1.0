# Deploying OneClickDeploy

This document is split into two parts:

1. **Current MVP deployment (implemented now)**
2. **Target extended architecture (future roadmap, not implemented yet)**

---

## 1) Current MVP deployment (implemented)

### Runtime topology

- Single web service: Next.js app
- No database
- No worker process
- No queues
- No provider webhooks

### Required environment variables

Use `.env.example` as source of truth:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

> The app validates required auth env vars at startup and fails fast when missing.

### Deployment checklist (MVP)

1. Configure required env vars in your platform secret manager.
2. Configure GitHub OAuth callback URL:
   - `https://YOUR_DOMAIN/api/auth/callback/github`
3. Deploy the web service.
4. Run post-deploy quality checks:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
5. Execute smoke flow:
   - Login with GitHub
   - Open dashboard
   - Select repo/branch
   - Open Vercel/Netlify deploy links

### Operational notes

- GitHub access token is kept server-side and used only by server route handlers.
- API routes include timeout/error mapping and basic pagination support.
- Dashboard includes local browser preset for advanced deploy settings (single slot).

---

## 2) Target extended architecture (future, not implemented)

These items are roadmap-level and require architecture expansion:

- Worker service for asynchronous deployment orchestration
- Persistent database for deployment/user state
- Queue system for retries and backpressure
- Provider webhook ingestion and reconciliation
- Centralized observability (metrics, tracing, alerting)

Treat this section as planning guidance, not current runbook instructions.
