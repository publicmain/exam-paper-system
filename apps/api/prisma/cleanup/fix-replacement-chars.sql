-- Fix #2: Replace U+FFFD REPLACEMENT CHARACTER (the � black diamond) in
-- paper / question / template names with a normal middle dot · (U+00B7).
--
-- Background: the past-paper ingestion pipeline at one point passed text
-- through a layer that lost the original separator (probably middle-dot
-- in the source paper name) and substituted U+FFFD. The visible artifact
-- is "Mock Exam � 9709 P1 (SVG geometry)" on Dashboard / Papers list.
--
-- This script is idempotent: REPLACE is a no-op if there are no U+FFFD
-- chars left. Safe to run repeatedly.

-- Papers
UPDATE "Paper"
SET    "name" = REPLACE("name", U&'\FFFD', '·')
WHERE  "name" LIKE U&'%\FFFD%';

-- Just in case the corruption leaked elsewhere:
UPDATE "PaperTemplate"
SET    "name" = REPLACE("name", U&'\FFFD', '·')
WHERE  "name" LIKE U&'%\FFFD%';

UPDATE "Question"
SET    "sourceRef" = REPLACE("sourceRef", U&'\FFFD', '·')
WHERE  "sourceRef" LIKE U&'%\FFFD%';

UPDATE "Class"
SET    "name" = REPLACE("name", U&'\FFFD', '·')
WHERE  "name" LIKE U&'%\FFFD%';

-- Show what got cleaned (informational)
SELECT 'Paper' AS table_name, COUNT(*) AS still_corrupt FROM "Paper" WHERE "name" LIKE U&'%\FFFD%'
UNION ALL
SELECT 'PaperTemplate', COUNT(*) FROM "PaperTemplate" WHERE "name" LIKE U&'%\FFFD%'
UNION ALL
SELECT 'Question', COUNT(*) FROM "Question" WHERE "sourceRef" LIKE U&'%\FFFD%'
UNION ALL
SELECT 'Class', COUNT(*) FROM "Class" WHERE "name" LIKE U&'%\FFFD%';
