import { PrismaClient } from '@prisma/client';
import { OFFICIAL_WORDLIST_META, officialList, officialListVersion, type OfficialListName } from '../../src/vocab-v2/official-wordlists';
import { canonicalPos, senseKey, translationForPos } from '../../src/vocab-v2/sense-content';

const prisma = new PrismaClient();
const CHUNK = 200;
const CONCURRENCY = 20;

async function inBatches<T>(items: T[], worker: (item: T) => Promise<unknown>) {
  for (let offset = 0; offset < items.length; offset += CONCURRENCY) {
    await Promise.all(items.slice(offset, offset + CONCURRENCY).map(worker));
  }
}

async function importList(listName: OfficialListName) {
  const words = officialList(listName);
  let ready = 0;
  let needsTranslation = 0;

  for (let offset = 0; offset < words.length; offset += CHUNK) {
    const chunk = words.slice(offset, offset + CHUNK);
    const dictionary = await prisma.dictEntry.findMany({
      where: { word: { in: chunk.map((word) => word.headword) } },
    });
    const byWord = new Map(dictionary.map((row) => [row.word, row]));

    const prepared = chunk.map((word) => {
      const dict = byWord.get(word.headword);
      const pos = canonicalPos(word.pos || dict?.pos);
      const translation = translationForPos(dict?.translation, pos);
      const qualityStatus = translation ? 'ready' : 'needs_translation';
      if (translation) ready += 1;
      else needsTranslation += 1;
      return { word, dict, pos, translation, qualityStatus };
    });

    await prisma.vocabularyLexeme.createMany({
      data: prepared.map(({ word, dict }) => ({
          listName,
          listVersion: officialListVersion(listName),
          rank: word.rank,
          headword: word.headword,
          phonetic: word.phonetic || dict?.phonetic || null,
          attribution: OFFICIAL_WORDLIST_META.attribution,
      })),
      skipDuplicates: true,
    });
    const lexemes = await prisma.vocabularyLexeme.findMany({
      where: {
        listName,
        listVersion: officialListVersion(listName),
        headword: { in: chunk.map((word) => word.headword) },
      },
      select: { id: true, headword: true },
    });
    const lexemeByWord = new Map(lexemes.map((lexeme) => [lexeme.headword, lexeme]));

    await inBatches(prepared, async ({ word, pos, translation, qualityStatus }) => {
      const lexeme = lexemeByWord.get(word.headword);
      if (!lexeme) throw new Error(`lexeme_missing_after_import:${listName}:${word.headword}`);
      await prisma.vocabularySense.upsert({
        where: { lexemeId_senseKey: { lexemeId: lexeme.id, senseKey: senseKey(pos) } },
        create: {
          lexemeId: lexeme.id,
          senseKey: senseKey(pos),
          pos,
          definition: word.definition,
          translation,
          qualityStatus,
        },
        update: {
          pos,
          definition: word.definition,
          ...(translation ? { translation } : {}),
          qualityStatus,
        },
      });
    });
    process.stdout.write(`${listName}: ${Math.min(offset + CHUNK, words.length)}/${words.length}\r`);
  }
  process.stdout.write(`${listName}: ready=${ready}, needs_translation=${needsTranslation}\n`);
}

async function main() {
  await importList('ngsl');
  await importList('nawl');
}

main()
  .catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
