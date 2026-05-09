# Round 3 — Database & Data Integrity

## Findings
- 30+ FKs lack explicit `onDelete`. Prisma defaults to `NoAction` (= RESTRICT
  in Postgres) → user deletion blocked by audit-trail / authorship rows.
- Schema drift: `AnswerScript.paperQuestion` schema declares `Cascade`,
  prod DB has `RESTRICT` (project uses `db push --accept-data-loss`, no
  migrations folder). Next deploy reconciles.
- 13 models missing `updatedAt` (ExamBoard, Subject, SyllabusComponent,
  Topic, etc.).
- JSON fields `Question.content`, `Paper.config`, `NotificationConfig.target`
  — no zod schema; structure is comment-documented only.

## Status
- **Deferred**: Bulk schema-rewrite is out of scope for Round 1 — would
  generate a migration touching 30+ tables and risks live-data breakage.
  Project deploys via `db push --accept-data-loss`; safer fix is a
  follow-up consolidation PR with a separate review pass.
- WatermarkToken FKs already documented (schema.prisma:1241) — no change.

## Files changed
- (none — deferred to follow-up audit)
