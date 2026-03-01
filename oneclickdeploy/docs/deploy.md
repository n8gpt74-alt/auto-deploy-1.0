# Deploying OneClickDeploy

## Recommended production topology

- Web service: Next.js app (Vercel, Fly.io, or container platform)
- Worker service: dedicated Node.js process (`npm run dev:worker` replaced by `npm run worker` in prod)
- Database: managed Postgres (Supabase/Neon/RDS)
- Redis: Upstash Redis
- Secrets: platform secret manager

## Required environment variables

Use `.env.example` as source of truth. In production, set all values via secret manager.

## Deployment checklist

1. Provision Postgres and Redis.
2. Set all env vars in web and worker services.
3. Run Prisma migrations during release:

```bash
npm run prisma:generate
npm run prisma:migrate
```

4. Deploy web service.
5. Deploy worker service.
6. Configure OAuth callback URLs:
   - `https://YOUR_DOMAIN/api/auth/callback/github`
   - `https://YOUR_DOMAIN/api/providers/callback/vercel`
   - `https://YOUR_DOMAIN/api/providers/callback/netlify`
7. Configure webhook URLs:
   - `https://YOUR_DOMAIN/api/webhooks/github`
   - `https://YOUR_DOMAIN/api/webhooks/vercel`
   - `https://YOUR_DOMAIN/api/webhooks/netlify`
8. Enable monitoring on queue depth, failed deployments, and webhook errors.

## Scaling roadmap

- Scale web and worker independently.
- Add queue partitioning by provider.
- Introduce circuit breakers and provider-specific retry budgets.
- Add read replicas for high dashboard read load.
