/**
 * 内容白名单：**默认不上，审过的才放**（2026-10-20 叶老师定）。
 *
 * ## 为什么从黑名单改成白名单
 *
 * 「What is oral sex?」事故之前，自动生成的例句默认就是 `ready`，闸门查到脏的才拦。
 * 黑名单永远列不全：事故当天补一条规则就漏一条 —— bullshit、Wife swapping、
 * I piss on the corpus、I need to go poop 全是正则之外的。更糟的是自动补句：例句
 * 一下架，content-producer 就把那个词当成「缺例句」，复用同一行去 Tatoeba 拉一条
 * 没人审过的新句子，状态又是 `ready`。
 *
 * 所以把 `ready` 的含义改成「**审过了**」：
 *
 *   ready           审过，学生能看到（老师写的课程文章原句 article_original 也是这个状态）
 *   pending_review  还没审，学生看不到 —— 自动生成的一律落在这里
 *   blocked_school  审过，不许给学生（人工下架 / 闸门命中）
 *   needs_translation 缺中文，学生看不到（旧状态，保留）
 *
 * 面向学生的三处查询本来就只取 `ready`，所以这层改动的主体是**数据**（未审的改成
 * pending_review）和**写入方**（生产者不再写 ready），读取方只需要把兜底收紧。
 *
 * ## 搭配词怎么白名单
 *
 * 搭配词挂在词义上，没有自己的状态；而词义的 `qualityStatus` 被推送、查词、官方词表
 * 同步好几处读写，不能拿来当「审没审过」。好在搭配本来就是从例句里切出来的两连词，
 * 所以规则定成：**只显示出现在已审例句里的搭配**。例句审过，从它切出来的词组也就审过；
 * 例句没审 / 被拦，它切出来的 "oral sex"、"kill yourself" 自然跟着不显示。
 * agent 写新例句时同样要求搭配出现在例句里。
 */

export const APPROVED_STATUS = 'ready';
export const PENDING_REVIEW_STATUS = 'pending_review';

/** 学生能不能看到这条例句。没带状态字段的（测试 / 旧调用方）按审过处理，和原来一致。 */
export function isApprovedContext(row: { qualityStatus?: string | null }): boolean {
  return row.qualityStatus === undefined || row.qualityStatus === null || row.qualityStatus === APPROVED_STATUS;
}

function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? []);
}

/**
 * 只留**出现在某条已审例句里**的搭配（按整词连续匹配，不区分大小写）。
 * 「出现」指词组的每个词按顺序紧挨着出现在句子里 —— "oral sex" 不会因为句子里分别
 * 有 oral 和 sex 就算数。顺序原样保留。
 */
export function collocationsBackedByApproved(
  collocations: readonly string[],
  contexts: ReadonlyArray<{ sentence?: string | null; qualityStatus?: string | null }> | null | undefined,
): string[] {
  const approved = (contexts ?? [])
    .filter((row) => isApprovedContext(row) && typeof row.sentence === 'string')
    .map((row) => ` ${words(row.sentence as string).join(' ')} `);
  if (!approved.length) return [];
  return collocations.filter((phrase) => {
    const key = words(phrase).join(' ');
    return key.length > 0 && approved.some((sentence) => sentence.includes(` ${key} `));
  });
}
