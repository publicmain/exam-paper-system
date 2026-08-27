/**
 * P8.5 —— 打开卷子时，本地缓存与服务端答案怎么合（纯函数）。
 *
 * 两个方向都会出事，所以只能按序号判断谁更新：
 *
 * - **服务端无条件优先** → 丢掉还没传上去的输入（弱网重试队列里、
 *   这个标签当时是次要标签、学生直接关了页面）。页面显示「已答」而
 *   服务端一无所知，交卷时那一题是空的。
 * - **本地无条件优先** → 旧设备上的旧答案盖掉新设备刚写的。
 *
 * 序号相同时信服务端：那是同一次写，服务端那份**确定**存下来了。
 */

export interface DraftAnswer {
  selectedOption?: string;
  textAnswer?: string;
}

export interface MergeResult<T> {
  answers: Record<string, T>;
  /** 本地比服务端新的题 —— 加载后要补传，否则这些答案只存在于这台设备。 */
  resend: string[];
}

export function mergeDrafts<T extends DraftAnswer>(
  cached: Record<string, T>,
  cachedSeqs: Record<string, number>,
  server: Record<string, T>,
  serverSeqs: Record<string, number>,
): MergeResult<T> {
  const answers: Record<string, T> = { ...server };
  const resend: string[] = [];
  for (const [qid, local] of Object.entries(cached)) {
    const localSeq = cachedSeqs[qid];
    const serverSeq = serverSeqs[qid];
    if (qid in server) {
      // 没有本地序号（老版本写的缓存）就信服务端 —— 它至少确定存下来了。
      if (localSeq != null && (serverSeq == null || localSeq > serverSeq)) {
        answers[qid] = local;
        resend.push(qid);
      }
      continue;
    }
    // 只有本地有 —— 这一题服务端根本没收到过，必须补传。
    answers[qid] = local;
    resend.push(qid);
  }
  return { answers, resend };
}
