import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  // Tables that CASCADE-delete when Paper deletes — anything with a
  // RESTRICT/NO ACTION FK pointing into these is the real blocker.
  const cascadeChildren = [
    'Paper',
    'PaperAssignment',
    'PaperQuestion',
    'PaperVersion',
    'QuestionShuffleMap',
    'QuestionUsageLog',
    // PaperAssignment cascades to:
    'StudentSubmission',
    'PaperVariantAssignment',
    'MorningQuizSession',
    // StudentSubmission cascades to:
    'AnswerScript',
    'MarkerAssignment',
    // MorningQuizSession cascades to:
    'Attendance',
  ];
  const rows = await p.$queryRawUnsafe<any[]>(
    `
    SELECT
      ccu.table_name          AS parent_table,
      tc.table_name           AS child_table,
      kcu.column_name         AS child_column,
      tc.constraint_name      AS constraint_name,
      rc.delete_rule          AS on_delete
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = ANY($1::text[])
      AND rc.delete_rule IN ('NO ACTION','RESTRICT')
    ORDER BY ccu.table_name, tc.table_name;
  `,
    cascadeChildren,
  );
  console.log('RESTRICT/NO_ACTION FKs into cascade-children of Paper:');
  console.table(rows);
  await p.$disconnect();
})();
