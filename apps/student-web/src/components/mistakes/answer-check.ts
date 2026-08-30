/**
 * 错题重练的**判定与选项取值**（阶段 12B）。
 *
 * 三种选择式作答（`tfng` / `letters` / `options`）共用同一条判定：
 * 拿选项的**值**和服务端给的 `correctAnswer` 比，只抹掉首尾空白与大小写。
 *
 * ## 为什么只抹这两样
 *
 * 再宽一点就开始替学生判分了。`TRUE` 与 `true` 是同一个答案（大小写只是
 * 渲染风格），前后多个空格也是；但 `FALSE` 与 `NOT GIVEN`、`B` 与 `D`
 * 之间没有任何「差不多」可言。这一屏没有 AI、也不该有 —— 判宽了，学生
 * 会以为自己掌握了，而这道题本来就是他错过的那一道。
 *
 * ## 选项的两种形状
 *
 * 服务端可能给纯字符串（判断题的三键、段落字母、简单选项），也可能给
 * `{ key, text }`（题库里存了完整选项的 MCQ）。**判定看 `key`，显示看
 * `text`** —— 答案存的是字母键，拿选项正文去比永远不会相等。
 */
import type { MistakeOption } from '../../lib/api';

/** 用来和 `correctAnswer` 比对的那个值。 */
export function optionValue(o: MistakeOption): string {
  return typeof o === 'string' ? o : o.key;
}

/** 显示给学生看的那段文字。`{key,text}` 时把键也带上，学生要对着原文找。 */
export function optionLabel(o: MistakeOption): string {
  if (typeof o === 'string') return o;
  return o.text ? `${o.key}. ${o.text}` : o.key;
}

/** 判定 —— 只抹首尾空白与大小写，别的一律算不同。 */
export function answerMatches(chosen: string, correctAnswer: string): boolean {
  return chosen.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
}

/** 这个选项对不对。 */
export function optionIsCorrect(o: MistakeOption, correctAnswer: string): boolean {
  return answerMatches(optionValue(o), correctAnswer);
}

/** 题型的人话。认不出来的**原样显示**，不猜。 */
const TASK_TEXT: Readonly<Record<string, string>> = {
  true_false_not_given: '判断题',
  yes_no_not_given: '判断题',
  matching_information: '段落匹配',
  matching_headings: '标题匹配',
  short_answer: '简答题',
  mcq: '选择题',
  summary_completion: '摘要填空',
  sentence_completion: '完成句子',
};

export function taskTypeLabel(taskType: string): string {
  return TASK_TEXT[taskType] ?? taskType;
}

/** 为什么这道题会进错题本。同样，认不出来的原样显示。 */
const REASON_TEXT: Readonly<Record<string, string>> = {
  long_answer: '长答题（老师有评语）',
  vocabulary: '词义题',
  repeated_tasktype: '这类题反复错',
};

export function reasonLabel(reason: string): string {
  return REASON_TEXT[reason] ?? reason;
}
