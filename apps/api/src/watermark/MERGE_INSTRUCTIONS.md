# B10 Watermark — Merge Instructions

This block adds **per-student paper watermarking** to PDF export. Tokens are
issued per (paper, student) pair, embedded in the downloaded PDF as a visible
overlay, and resolvable via a forensic lookup endpoint when a leaked copy is
recovered.

## 1. Schema (concatenate `prisma/path-b-fragments/b10.prisma` into `schema.prisma`)

In addition to the new `WatermarkToken` model, the integrator MUST add the
following back-relations to existing models so Prisma compiles cleanly:

### `Paper`

```prisma
model Paper {
  // ...existing fields...
  watermarkTokens WatermarkToken[]
}
```

### `User`

```prisma
model User {
  // ...existing fields...
  watermarkTokens WatermarkToken[] @relation("WatermarkTokenStudent")
}
```

### `PaperAssignment`

```prisma
model PaperAssignment {
  // ...existing fields...
  watermarkTokens WatermarkToken[]
}
```

After concatenating, run:

```bash
cd apps/api
npx prisma format
npx prisma generate
npx prisma migrate dev --name add_watermark_token
```

## 2. Module registration (`app.module.ts`)

Add `WatermarkModule` to the imports list:

```ts
import { WatermarkModule } from './watermark/watermark.module';

@Module({
  imports: [
    // ...
    WatermarkModule,
  ],
})
export class AppModule {}
```

`WatermarkModule` already imports `PdfModule` to reuse the shared
Puppeteer instance — do NOT also re-provide `PdfService` directly.

## 3. Dependency check — `pdf-lib`

**As of this fragment, `pdf-lib` is NOT in `apps/api/package.json` dependencies.**
The watermark code will boot without it (it uses `require()` inside the overlay
function and surfaces a 500 with a clear message if missing), but the download
endpoint will fail until the dep is installed.

I have already edited `apps/api/package.json` to add:

```json
"pdf-lib": "^1.17.1"
```

to the `dependencies` block. **At integration time, run:**

```bash
cd apps/api
npm install
```

(The agent did NOT run `npm install` because other path-B agents are running in
parallel and concurrent installs corrupt `node_modules`.)

## 4. API surface (added by this block)

All routes are mounted under `/api/watermark` (global `/api` prefix +
controller `@Controller('watermark')`).

| Method | Path                                                  | Auth                                  | Purpose                                                 |
|--------|-------------------------------------------------------|---------------------------------------|---------------------------------------------------------|
| POST   | `/api/watermark/papers/:paperId/student/:studentId/token` | teacher / head_teacher / admin   | Get-or-create a watermark token; returns `{token, downloadUrl}`. |
| GET    | `/api/watermark/download?token=XXX`                   | teacher / head_teacher / admin        | Returns the watermarked paper PDF. 410 if revoked.      |
| POST   | `/api/watermark/tokens/:id/revoke`                    | **admin only**                        | Revoke a token (future downloads return 410).           |
| GET    | `/api/watermark/lookup?token=XXX`                     | **admin only**                        | Forensic: token → `{paper, student, assignment}`.       |

`apps/web/src/lib/api.ts` is OWNED BY ANOTHER AGENT — I did not touch it. The
frontend integrator should add three methods (mirroring the existing
`api.papers.export()` pattern):

```ts
api.watermark.issue(paperId: string, studentId: string)
  -> POST /watermark/papers/:paperId/student/:studentId/token
api.watermark.lookup(token: string)
  -> GET /watermark/lookup?token=...
api.watermark.revoke(tokenId: string)
  -> POST /watermark/tokens/:id/revoke
```

The download URL is a plain GET that includes the JWT in the
`Authorization` header (it must — see Authz Checklist below), so the UI
should hit it via `fetch()` with credentials rather than a naked
`window.open()`.

## 5. Test script

`tests/blackbox/b10-watermark.sh` — issues a token, downloads, asserts:

- Response is `application/pdf`
- First 5 bytes are `%PDF-`
- Body length is plausible (>1KB)
- Lookup as admin resolves token to the student
- Lookup as teacher (non-admin) is rejected
- Revoke + re-download returns 410

Soft-fail mode: if the API returns a 500 with `pdf-lib not installed`, the
test prints a warning and exits 0. After running `npm install`, re-run.
