-- R10 — A-plan: a class can register MULTIPLE difficulty bands at once.
-- Each band gets its own MorningQuizSession per day, so students see
-- one QR per band on the projector.
--
-- Schema changes:
--   * MorningQuizSession adds `level` (default ielts_authentic for the
--     existing rows so the unique flip below doesn't collide).
--   * MorningQuizSession unique flips from (date, classId) →
--     (date, classId, level) so 3 sessions can share a (date, classId).
--   * ClassEnglishLevel.classId loses its UNIQUE; a (classId, level)
--     compound unique replaces it so a class can carry multiple bands.

-- 1. add level on MorningQuizSession (nullable first so we can backfill)
ALTER TABLE "MorningQuizSession"
  ADD COLUMN IF NOT EXISTS "level" "EnglishLevel";

-- 2. backfill: every existing session inherits its class's currently-
--    registered level if there is one, otherwise defaults to
--    ielts_authentic (the historical default).
UPDATE "MorningQuizSession" s
SET "level" = COALESCE(
  (SELECT cel."level" FROM "ClassEnglishLevel" cel WHERE cel."classId" = s."classId" LIMIT 1),
  'ielts_authentic'::"EnglishLevel"
)
WHERE s."level" IS NULL;

-- 3. now NOT NULL + default for new rows
ALTER TABLE "MorningQuizSession"
  ALTER COLUMN "level" SET NOT NULL,
  ALTER COLUMN "level" SET DEFAULT 'ielts_authentic';

-- 4. flip the unique constraint. Like ClassEnglishLevel below, Prisma's
--    original `@@unique` was created as `CREATE UNIQUE INDEX` (not
--    `ADD CONSTRAINT`), so DROP CONSTRAINT is a no-op and the unique
--    INDEX with the same name survives, blocking a second session per
--    (date, classId). Drop the index explicitly too.
ALTER TABLE "MorningQuizSession"
  DROP CONSTRAINT IF EXISTS "MorningQuizSession_date_classId_key";
DROP INDEX IF EXISTS "MorningQuizSession_date_classId_key";
ALTER TABLE "MorningQuizSession"
  ADD CONSTRAINT "MorningQuizSession_date_classId_level_key"
  UNIQUE ("date", "classId", "level");

-- 5. ClassEnglishLevel: drop the 1:1 unique, add (classId, level) unique +
--    classId index for the lookup pattern.
--
-- Drop both the constraint AND the underlying index. Prisma originally
-- created `@unique` as `CREATE UNIQUE INDEX`, leaving only an index (no
-- separate CONSTRAINT) — `DROP CONSTRAINT IF EXISTS` is then a no-op
-- and the unique INDEX survives, blocking inserts of a second level
-- per class. Drop both defensively.
ALTER TABLE "ClassEnglishLevel"
  DROP CONSTRAINT IF EXISTS "ClassEnglishLevel_classId_key";
DROP INDEX IF EXISTS "ClassEnglishLevel_classId_key";
ALTER TABLE "ClassEnglishLevel"
  ADD CONSTRAINT "ClassEnglishLevel_classId_level_key"
  UNIQUE ("classId", "level");
CREATE INDEX IF NOT EXISTS "ClassEnglishLevel_classId_idx"
  ON "ClassEnglishLevel" ("classId");
