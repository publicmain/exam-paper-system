/**
 * 校园内容闸门 —— 每日自动推词唯一的人工把关处。
 *
 * 每日新词是顺着 NGSL / NAWL 按排名往后取的（`collectUnseenFromList`），
 * 过滤条件原来只有一条「学生见没见过」。官方词表是通用语料排名，不是
 * 中学教材：2026-09-21 有学生的当日第一个词就是 breast，中文释义
 * 「n. 胸部, 乳房, 胸怀」。同样已经推出去的还有 sex「n. 性别, 性欲」。
 * 按排名往后走，sperm / sexual / naked 也都在射程内。
 *
 * 两张表，两种动作：
 *
 * - `BLOCKED`：自动推送不取、学生查词不返回。**老师在词表里手动指定的词
 *   不受这里限制** —— 那是老师对自己班的明确决定；学生在文章里点开的词
 *   也照常能查，他已经读到了，拦下来只会让工具显得坏掉。
 * - `GLOSS`：词典义项是整条堆砌的，有些词第一条就跑偏（drug 的「麻药」、
 *   hip 的「忧郁」）。词本身留着，中文释义用这里的人工版本盖掉。
 *
 * 要加词就往下面两张表里写，不用改逻辑。`school-safe-words.spec.ts` 守住
 * 三件事：名单里的拼写必须真在官方词表里（防止拼错变成摆设）、两张表不
 * 重叠、释义非空。
 */
import { officialList, type OfficialListName } from './official-wordlists';

/** 自动推送与学生查词都不给的词（2026-09-21 定，叶老师可增删）。 */
export const SCHOOL_BLOCKED_HEADWORDS: readonly string[] = [
  // 身体 / 性
  'sex',
  'sexual',
  'breast',
  'sperm',
  'naked',
  // 粗口 / 贬损：教育价值不抵课堂上念出来的代价
  'damn',
  'hell',
  'bloody',
  'stupid',
  // 自伤
  'suicide',
];

/**
 * 保留在推送里、但中文释义换成人工版本的词。
 * 左边是官方词表拼写，右边是学生看到的释义。
 */
export const SCHOOL_GLOSS_OVERRIDES: Readonly<Record<string, string>> = {
  // 词典第一条是「药, 麻药, 麻醉药」外加动词「吸毒」，学术义反而排在后面
  drug: 'n. 药物, 药品；（医学）用药',
  // 「n. 臀部, 蔷薇果, 忧郁」—— 后两条是噪声
  hip: 'n. 臀部, 髋部',
  // drug abuse / abuse of power 是学术高频，但别把「辱骂」排在最前
  abuse: 'n. 滥用；虐待  vt. 滥用, 虐待',
  pregnant: 'a. 怀孕的；（比喻）意味深长的',
  pregnancy: 'n. 怀孕, 孕期',
  smoke: 'n. 烟, 烟雾  vi. 冒烟；吸烟',
};

const blockedKeys = new Set(SCHOOL_BLOCKED_HEADWORDS.map((word) => word.trim().toLowerCase()));
const glossKeys = new Map(
  Object.entries(SCHOOL_GLOSS_OVERRIDES).map(([word, gloss]) => [word.trim().toLowerCase(), gloss]),
);

/** 这个拼写能不能进每日推送 / 学生查词结果。 */
export function isSchoolBlockedHeadword(headword: string): boolean {
  return blockedKeys.has(String(headword ?? '').trim().toLowerCase());
}

/** 人工释义；没有就返回 null，照常用词典释义。 */
export function schoolGlossOverride(headword: string): string | null {
  return glossKeys.get(String(headword ?? '').trim().toLowerCase()) ?? null;
}

/** 去掉不该推给学生的词；顺序与其余字段原样保留。 */
export function withoutBlockedWords<T extends { headword: string }>(words: readonly T[]): T[] {
  return words.filter((word) => !isSchoolBlockedHeadword(word.headword));
}

/** 名单里每个拼写在官方词表里的位置，给测试和排查用。 */
export function locateInOfficialLists(headword: string): Array<{ list: OfficialListName; rank: number }> {
  const key = String(headword ?? '').trim().toLowerCase();
  return (['ngsl', 'nawl'] as const).flatMap((list) =>
    officialList(list)
      .filter((word) => word.headword.trim().toLowerCase() === key)
      .map((word) => ({ list, rank: word.rank })),
  );
}
