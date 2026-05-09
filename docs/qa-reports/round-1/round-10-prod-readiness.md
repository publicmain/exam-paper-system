# Round 10 — Error Handling, Security, Production Readiness

## Critical (FIXED)
- `main.ts:7` CORS = `true` (allow all). **FIXED** — `resolveCorsOrigin()`
  reads `CORS_ORIGINS`, falls back to `*` only with prod-warn log.
- `app.module.ts:53` JWT default `'dev-secret'`. **FIXED** — `bootstrap`
  refuses to start in NODE_ENV=production with default/missing secret.
- No `unhandledRejection` / `uncaughtException` handlers. **FIXED** —
  added in `main.ts`.

## High (DEFERRED)
- No `helmet`, no `@nestjs/throttler` rate limit. Adds new dependencies;
  done as separate concern.
- List endpoints (`/papers`, `/users`, `/classes`) return all rows without
  pagination. **DEFERRED** — broad change to many services.
- `Dockerfile` uses `prisma db push --accept-data-loss` instead of
  `migrate deploy`. **NOTED** — schema is single-source-of-truth, project
  has no migrations folder.
- Audit log silent failure (`audit.service.ts:40`). **DEFERRED** — needs
  durable-queue work.

## Files changed
- `apps/api/src/main.ts`

## Deferred to Round 2 / follow-up
- helmet + throttler
- list pagination
- audit dead-letter
