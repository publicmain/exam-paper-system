/**
 * 词汇回归测试的场景搭建。只往内存假库里 seed，不连任何数据库、不发网络请求。
 */
import { officialList, officialListVersion, type OfficialListName } from '../official-wordlists';
import { canonicalPos, senseKey } from '../sense-content';
import { VocabularyV2Service } from '../vocabulary-v2.service';
import { memoryPrisma, type MemoryPrisma } from './memory-prisma';

export type Db = MemoryPrisma & Record<string, any>;

/** 假翻译：确定性、零网络；可以按需让它失败。 */
export function fakeTranslator(overrides: Record<string, string | null> = {}) {
  const calls: string[] = [];
  return {
    calls,
    async translate(text: string) {
      calls.push(text);
      if (text in overrides) return overrides[text];
      return `译:${text}`;
    },
    async translateDetailed(text: string) {
      calls.push(text);
      if (text in overrides) {
        const value = overrides[text];
        return value
          ? { text: value, status: 'ok' as const, retryable: false, provider: 'fake' }
          : { text: null, status: 'unavailable' as const, retryable: true, provider: 'fake' };
      }
      return { text: `译:${text}`, status: 'ok' as const, retryable: false, provider: 'fake' };
    },
  };
}

export function makeService(db: Db, translator: any = fakeTranslator()) {
  return new VocabularyV2Service(db as any, translator);
}

export function newDb(): Db {
  return memoryPrisma();
}

export function seedStudent(db: Db, input: {
  id?: string;
  level?: string | null;
  classId?: string;
  joinedAt?: Date;
  name?: string;
  dailyTarget?: number;
} = {}) {
  const id = input.id ?? 'stu-1';
  const classId = input.classId ?? 'class-1';
  db.seed('user', { id, email: `${id}@test.invalid`, name: input.name ?? id, passwordHash: 'x', englishLevel: input.level === undefined ? 'olevel' : input.level });
  if (!db.rows('class', { id: classId }).length) db.seed('class', { id: classId, name: classId, classCode: classId.toUpperCase() });
  db.seed('classEnrollment', { classId, userId: id, role: 'student', joinedAt: input.joinedAt ?? new Date('2026-08-01T00:00:00.000Z') });
  if (input.dailyTarget) db.seed('studentVocabularyProfile', { studentId: id, dailyTarget: input.dailyTarget });
  return id;
}

/**
 * 给官方词表的一段词建好「可发布」的 sense：有中文、有英文释义、有一条含目标词
 * 且带译文的短例句。中文按词各不相同，免得选择题因为夹具本身出现同义选项。
 */
export function seedOfficialWords(db: Db, list: OfficialListName, fromRank: number, count: number, opts: {
  translation?: (headword: string) => string;
  publishable?: boolean;
} = {}) {
  const version = officialListVersion(list);
  const words = officialList(list).slice(fromRank - 1, fromRank - 1 + count);
  const senses: Array<{ senseId: string; headword: string; rank: number }> = [];
  for (const word of words) {
    const lexemeId = `lex-${list}-${word.headword}`;
    const senseId = `sense-${list}-${word.headword}`;
    const pos = canonicalPos(word.pos);
    if (!db.rows('vocabularyLexeme', { id: lexemeId }).length) {
      db.seed('vocabularyLexeme', { id: lexemeId, listName: list, listVersion: version, rank: word.rank, headword: word.headword, phonetic: word.phonetic, attribution: 'NGSL test' });
      db.seed('vocabularySense', {
        id: senseId, lexemeId, senseKey: senseKey(pos), pos,
        definition: word.definition || `definition of ${word.headword}`,
        translation: opts.translation ? opts.translation(word.headword) : `${pos === 'noun' ? 'n.' : pos === 'verb' ? 'v.' : 'adj.'} 中文${word.headword}`,
        qualityStatus: 'ready',
      });
      if (opts.publishable !== false) {
        db.seed('vocabularyContext', {
          senseId, kind: 'short_same_meaning', position: 1, difficulty: 1,
          sentence: `We talked about the ${word.headword} again today.`,
          translation: `我们今天又谈到了${word.headword}。`, provider: 'tatoeba+azure_translator',
        });
      }
    }
    senses.push({ senseId, headword: word.headword, rank: word.rank });
  }
  return senses;
}

/** 某天在周一到周五之间的 Date（SGT 当天中午）。 */
export function sgtNoon(dateKey: string) {
  return new Date(`${dateKey}T04:00:00.000Z`);
}
