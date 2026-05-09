# Round 2 — Backend API Validation

## Critical / High
- `attendance.controller.ts:29` `deviceUuid` was `.optional()` → curl loop
  could sign 30 students from one device. **FIXED** — required + charset regex.
- `templates.controller.ts:13,14` create/update body typed `any` → arbitrary
  Prisma data injection. **FIXED** — zod whitelist (name/subject/duration/
  totalMarks/config).
- `papers.controller.ts:38` updatePaper body `any` → could overwrite
  `ownerId`, `totalMarksActual`. **FIXED** — `UpdatePaperSchema` whitelist.
- `papers.controller.ts:64-74` export() — `Content-Disposition` filename
  used raw paper id. **FIXED** — sanitised to `[A-Za-z0-9_-]`.
- `papers.controller.ts:66` `type: 'paper' | 'answer_key'` only TS-typed,
  not runtime-validated. **FIXED** — `ExportTypeSchema = z.enum(...)`.
- `questions.controller.ts:38` addAsset body `any` → arbitrary URL/altText.
  **FIXED** — zod (assetType enum, storageUrl URL, altText max 500).
- `admin-cleanup.controller.ts:31,47,65` purge/repair bodies untyped;
  `scope:'drop_everything'` would silently match the `'sessions-only'`
  branch. **FIXED** — three zod schemas with locked enums.
- `auth.controller.ts:9` password no `MaxLength` → memory exhaustion via
  giant body. **FIXED** — MaxLength(256), email MaxLength(320).
- `users.controller.ts:10` same. **FIXED**.

## Medium (deferred — separate task)
- `quality-feedback.controller.ts` `meta: z.record(z.string(), z.any())`
- `practice.controller.ts` query fallback to '9618' hides missing-param bug
- `references.controller.ts:14,19,24` weak query validation

## Files changed
- `apps/api/src/attendance/attendance.controller.ts`
- `apps/api/src/admin-cleanup/admin-cleanup.controller.ts`
- `apps/api/src/papers/papers.controller.ts`
- `apps/api/src/templates/templates.controller.ts`
- `apps/api/src/questions/questions.controller.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/users/users.controller.ts`
