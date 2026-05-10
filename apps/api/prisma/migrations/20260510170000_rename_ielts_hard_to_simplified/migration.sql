-- R10 — rename EnglishLevel.ielts_hard to ielts_simplified
--
-- Background: the original `ielts_hard` value's intent was the middle
-- difficulty band ("simplified IELTS for strong O-Level students"), but
-- the name and the levelToQuickPaperInput config drifted to mean
-- "harder than authentic". The product spec is three ascending bands
-- (olevel < ielts_simplified < ielts_authentic), so we rename in place.
--
-- Postgres 12+ supports ALTER TYPE ... RENAME VALUE; the rename
-- automatically updates every existing row referencing the value, so
-- no UPDATE pass is needed. Idempotent: skips if the target already
-- exists from a previous run.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'EnglishLevel' AND e.enumlabel = 'ielts_hard'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'EnglishLevel' AND e.enumlabel = 'ielts_simplified'
  ) THEN
    ALTER TYPE "EnglishLevel" RENAME VALUE 'ielts_hard' TO 'ielts_simplified';
  END IF;
END$$;
