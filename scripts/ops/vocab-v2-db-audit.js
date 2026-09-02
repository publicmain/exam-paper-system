/* eslint-disable no-console */
const { Client } = require('pg');

async function scalar(client, text, params = []) {
  return Number((await client.query(text, params)).rows[0]?.count || 0);
}

async function main() {
  const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_PUBLIC_URL or DATABASE_URL is required');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const unmigrated = (await client.query(`
      select distinct sw.headword, sw."translationSnapshot", dict.translation as "dictionaryTranslation",
        dict.definition as "dictionaryDefinition", dict.pos as "dictionaryPos"
      from "StudentWord" sw
      left join "VocabularyCollectionEvent" event
        on event."sourceRef" = 'legacy-student-word:' || sw.id
      left join "DictEntry" dict on dict.word = sw.headword
      where event.id is null
      order by sw.headword
    `)).rows;
    const contentJobSummary = (await client.query(`
      select status, provider, coalesce("errorCode", '') as "errorCode", count(*)::int as count
      from "VocabularyContentJob"
      group by status, provider, coalesce("errorCode", '')
      order by status, provider, "errorCode"
    `)).rows;
    const publishableContexts = (await client.query(`
      select c.provider, c.kind, count(*)::int as count
      from "VocabularyContext" c
      where c."qualityStatus" = 'ready'
        and c.kind in ('short_same_meaning', 'alternate_topic')
      group by c.provider, c.kind
      order by c.provider, c.kind
    `)).rows;
    const failedJobSamples = (await client.query(`
      select l.headword, l."listName", l.rank, s.pos, j.attempts, j."errorCode"
      from "VocabularyContentJob" j
      join "VocabularySense" s on s.id = j."senseId"
      join "VocabularyLexeme" l on l.id = s."lexemeId"
      where j.status = 'failed'
      order by j."updatedAt" desc
      limit 25
    `)).rows;
    const curriculumCoverage = (await client.query(`
      select band, count(*)::int as count
      from (
        select distinct s.id,
          case
            when l."listName" = 'ngsl' and l.rank between 1001 and 1120 then 'ngsl:1001-1120'
            when l."listName" = 'ngsl' and l.rank between 1401 and 1520 then 'ngsl:1401-1520'
            when l."listName" = 'ngsl' and l.rank between 1801 and 1920 then 'ngsl:1801-1920'
            when l."listName" = 'nawl' and l.rank between 1 and 160 then 'nawl:1-160'
          end as band
        from "VocabularySense" s
        join "VocabularyLexeme" l on l.id = s."lexemeId"
        where exists (
          select 1 from "VocabularyContext" c
          where c."senseId" = s.id and c.kind = 'short_same_meaning' and c."qualityStatus" = 'ready'
        ) and exists (
          select 1 from "VocabularyContext" c
          where c."senseId" = s.id and c.kind = 'alternate_topic' and c."qualityStatus" = 'ready'
        )
      ) covered
      where band is not null
      group by band
      order by band
    `)).rows;
    const report = {
      legacyStudentWords: await scalar(client, 'select count(*) from "StudentWord"'),
      lexemes: await scalar(client, 'select count(*) from "VocabularyLexeme"'),
      ngslLexemes: await scalar(client, 'select count(*) from "VocabularyLexeme" where "listName" = $1', ['ngsl']),
      nawlLexemes: await scalar(client, 'select count(*) from "VocabularyLexeme" where "listName" = $1', ['nawl']),
      senses: await scalar(client, 'select count(*) from "VocabularySense"'),
      readySenses: await scalar(client, 'select count(*) from "VocabularySense" where "qualityStatus" = $1', ['ready']),
      studentSenses: await scalar(client, 'select count(*) from "StudentVocabularySense"'),
      collectionEvents: await scalar(client, 'select count(*) from "VocabularyCollectionEvent"'),
      contexts: await scalar(client, 'select count(*) from "VocabularyContext"'),
      contentJobs: await scalar(client, 'select count(*) from "VocabularyContentJob"'),
      v2Migrations: await scalar(client, "select count(*) from \"_prisma_migrations\" where migration_name like '20260901%vocabulary_%' and finished_at is not null and rolled_back_at is null"),
      activeConnections: await scalar(client, "select count(*) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and state <> 'idle'"),
      contentJobSummary,
      publishableContexts,
      failedJobSamples,
      curriculumCoverage,
      unmigratedLegacy: unmigrated,
    };
    console.log(JSON.stringify(report));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exitCode = 1;
});
