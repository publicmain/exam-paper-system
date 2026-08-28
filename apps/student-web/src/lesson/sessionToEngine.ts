/**
 * 把会话载荷里的「服务端已存答案」翻成状态引擎的初始值。
 *
 * 放在这里而不是页面里，是为了让「页面不重新实现保存语义」这条守卫
 * 说得准：序号是引擎的概念，页面只该把服务端给的数字原样递进去，
 * 不该在页面代码里出现任何对它的运算。
 */
import type { ReadingExistingAnswer } from '../lib/api';
import type { ExamAnswer } from './examTypes';

type Existing = Record<string, ReadingExistingAnswer>;

/** 只取两个可编辑字段；`content` 是给老客户端的兼容字段，不读。 */
export function initialAnswersOf(existing: Existing): Record<string, ExamAnswer> {
  const out: Record<string, ExamAnswer> = {};
  for (const [qid, a] of Object.entries(existing ?? {})) {
    const ans: ExamAnswer = {};
    if (a?.selectedOption != null) ans.selectedOption = a.selectedOption;
    if (a?.textAnswer != null) ans.textAnswer = a.textAnswer;
    out[qid] = ans;
  }
  return out;
}

/** 每题服务端已接受的最大序号。没有的题就不给种子，引擎从 0 起。 */
export function initialSeqsOf(existing: Existing): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [qid, a] of Object.entries(existing ?? {})) {
    if (typeof a?.clientSeq === 'number') out[qid] = a.clientSeq;
  }
  return out;
}
