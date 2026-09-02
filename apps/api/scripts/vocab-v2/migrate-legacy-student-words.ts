import { PrismaClient } from '@prisma/client';
import { OFFICIAL_WORDLIST_META, officialList, officialListVersion, type OfficialWord } from '../../src/vocab-v2/official-wordlists';
import { canonicalPos, senseKey, translationForPos } from '../../src/vocab-v2/sense-content';

const prisma = new PrismaClient();
const CONCURRENCY = 10;
const LEGACY_SENSE_OVERRIDES: Record<string, {
  pos: string;
  definition: string;
  translation: string;
  qualityStatus: 'ready' | 'excluded';
}> = {
  // Preserve old records that are not dictionary headwords without allowing a
  // person's name to leak into daily vocabulary selection.
  amirah: { pos: 'proper_noun', definition: 'a female given name', translation: '阿米拉', qualityStatus: 'excluded' },
  coronagraph: { pos: 'noun', definition: 'an instrument that blocks a bright star or the Sun so nearby objects can be observed', translation: '日冕仪', qualityStatus: 'ready' },
  deformable: { pos: 'adjective', definition: 'capable of being changed in shape by force', translation: '可变形的', qualityStatus: 'ready' },
  froglet: { pos: 'noun', definition: 'a young frog', translation: '幼蛙', qualityStatus: 'ready' },
  intergenerational: { pos: 'adjective', definition: 'involving or affecting people from different generations', translation: '不同世代之间的', qualityStatus: 'ready' },
  payout: { pos: 'noun', definition: 'an amount of money paid to someone', translation: '支付的款项', qualityStatus: 'ready' },
};
const officialByHeadword = new Map<string, OfficialWord>();
for (const word of [...officialList('ngsl'), ...officialList('nawl')]) {
  if (!officialByHeadword.has(word.headword)) officialByHeadword.set(word.headword, word);
}

function sourceOf(source: string) {
  if (source === 'wrong_answer') return 'reading_error';
  if (source === 'teacher_push') return 'teacher_list';
  return 'reading_lookup';
}

function stageOf(word: { state: string; reps: number; firstTaughtAt: Date | null }) {
  if (word.state === 'known') return 8;
  if (!word.firstTaughtAt && word.reps === 0) return 1;
  return Math.max(2, Math.min(7, 2 + word.reps));
}

async function migrateOne(word: any) {
  const official = officialByHeadword.get(word.headword);
  const dict = await prisma.dictEntry.findUnique({ where: { word: word.headword } });
  const override = LEGACY_SENSE_OVERRIDES[word.headword];
  const pos = override?.pos || canonicalPos(official?.pos || dict?.pos);
  const translation = override?.translation || translationForPos(dict?.translation, pos) || word.translationSnapshot || '';
  const definition = override?.definition || official?.definition || dict?.definition || '';
  const qualityStatus = override?.qualityStatus || 'ready';
  if (!translation || !definition) return 'skipped';
  const listName = official?.list ?? 'personal';
  const listVersion = official ? officialListVersion(official.list) : '1';
  const sourceRef = `legacy-student-word:${word.id}`;
  await prisma.$transaction(async (tx) => {
    const lexeme = await tx.vocabularyLexeme.upsert({
      where: { listName_listVersion_headword: { listName, listVersion, headword: word.headword } },
      create: {
        listName, listVersion, rank: official?.rank ?? 0, headword: word.headword,
        phonetic: official?.phonetic || dict?.phonetic || null,
        attribution: official ? OFFICIAL_WORDLIST_META.attribution : 'legacy student vocabulary / ECDICT',
      },
      update: {},
    });
    const sense = await tx.vocabularySense.upsert({
      where: { lexemeId_senseKey: { lexemeId: lexeme.id, senseKey: senseKey(pos) } },
      create: { lexemeId: lexeme.id, senseKey: senseKey(pos), pos, definition, translation, qualityStatus },
      update: {},
    });
    const stage = stageOf(word);
    const owned = await tx.studentVocabularySense.upsert({
      where: { studentId_senseId: { studentId: word.studentId, senseId: sense.id } },
      create: {
        studentId: word.studentId, senseId: sense.id, masteryStage: stage, due: word.due,
        stability: word.stability, difficulty: word.difficulty, elapsedDays: word.elapsedDays,
        scheduledDays: word.scheduledDays, reps: word.reps, lapses: word.lapses,
        lastReview: word.lastReview, firstSeenAt: word.createdAt,
        ...(stage === 8 ? { masteredAt: word.updatedAt } : {}),
      },
      update: {
        masteryStage: stage, due: word.due, stability: word.stability, difficulty: word.difficulty,
        reps: word.reps, lapses: word.lapses, lastReview: word.lastReview,
        ...(stage === 8 ? { masteredAt: word.updatedAt } : {}),
      },
    });
    if (word.contextSentence?.trim()) {
      const sentence = word.contextSentence.trim();
      const existingContext = await tx.vocabularyContext.findFirst({ where: { senseId: sense.id, sentence } });
      if (!existingContext) {
        const position = await tx.vocabularyContext.count({ where: { senseId: sense.id, kind: 'article_original' } }) + 1;
        await tx.vocabularyContext.create({
          data: {
            senseId: sense.id, kind: 'article_original', position, sentence,
            translation: word.contextTranslation?.trim() || '', sourceTitle: word.sourcePassageTitle,
            sourceRef, provider: 'legacy_migration', attribution: 'student reading history',
            qualityStatus: word.contextTranslation?.trim() ? 'ready' : 'needs_translation',
          },
        });
      }
    }
    const existingEvent = await tx.vocabularyCollectionEvent.findFirst({ where: { studentId: word.studentId, sourceRef } });
    if (!existingEvent) {
      await tx.vocabularyCollectionEvent.create({
        data: {
          studentId: word.studentId, senseId: sense.id, studentSenseId: owned.id,
          source: sourceOf(word.sourceType), action: stage === 8 ? 'known' : 'learn',
          sourceTitle: word.sourcePassageTitle, sourceRef, contextText: word.contextSentence || null,
          metadata: { legacyStudentWordId: word.id }, createdAt: word.createdAt,
        },
      });
    }
  }, { maxWait: 10_000, timeout: 30_000 });
  return 'migrated';
}

async function main() {
  let cursor: string | undefined;
  let migrated = 0;
  let skipped = 0;
  const alreadyMigrated = new Set((await prisma.vocabularyCollectionEvent.findMany({
    where: { sourceRef: { startsWith: 'legacy-student-word:' } },
    select: { sourceRef: true },
  })).map((event) => event.sourceRef).filter((sourceRef): sourceRef is string => !!sourceRef));
  for (;;) {
    const rows = await prisma.studentWord.findMany({
      take: 250,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
    });
    if (!rows.length) break;
    // Different students often share the same headword. Prisma upsert is not
    // race-proof when two transactions create the same compound key at once,
    // so serialize identical headwords while retaining concurrency across words.
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      if (alreadyMigrated.has(`legacy-student-word:${row.id}`)) continue;
      groups.set(row.headword, [...(groups.get(row.headword) ?? []), row]);
    }
    const groupedRows = [...groups.values()];
    for (let offset = 0; offset < groupedRows.length; offset += CONCURRENCY) {
      const results = await Promise.all(groupedRows.slice(offset, offset + CONCURRENCY).map(async (group) => {
        const groupResults: string[] = [];
        for (const row of group) groupResults.push(await migrateOne(row));
        return groupResults;
      }));
      for (const result of results.flat()) {
        if (result === 'migrated') migrated++;
        else skipped++;
      }
    }
    cursor = rows.at(-1)!.id;
    process.stdout.write(`${JSON.stringify({ cursor, migrated, skipped })}\n`);
  }
  process.stdout.write(`${JSON.stringify({ done: true, migrated, skipped })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
