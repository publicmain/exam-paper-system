import { api, ApiError } from '../../lib/api';
import { extraResultKey, type ExtraResult } from '../../lib/extra-practice';
import { ownerDigest, readToken } from '../../lib/identity';

const active = new Map<string, Promise<void>>();
const prefixFor = (owner: string) => `sw:extra:${ownerDigest(owner)}:`;
function keys(owner: string): string[] {
  const prefix = prefixFor(owner); const result: string[] = [];
  for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key?.startsWith(prefix)) result.push(key); }
  return result;
}
const changed = () => window.dispatchEvent(new Event('extra-results-changed'));
export function pendingExtraResults(owner: string) { return keys(owner).length; }
export function queueExtraResult(owner: string, result: ExtraResult) {
  const key = prefixFor(owner) + extraResultKey(result);
  if (localStorage.getItem(key)) return;
  if (pendingExtraResults(owner) >= 1000) throw new Error('extra_queue_full');
  // One key per immutable result: two tabs cannot overwrite a shared array.
  // Storage errors reach the exercise before it advances.
  localStorage.setItem(key, JSON.stringify(result)); changed();
}
export function flushExtraResults(owner: string, stillOwner: () => boolean): Promise<void> {
  // An offline no-op must not occupy the worker slot: an online event may
  // arrive synchronously before a resolved Promise's finally callback runs.
  // 队列空就什么都不做：readToken() 会写一次存储探测键，空队列每 15 秒写一次没必要。
  let empty = true; try { empty = keys(owner).length === 0; } catch { /* 存储不可用：当作空 */ }
  if (empty || navigator.onLine === false || !readToken() || !stillOwner()) return Promise.resolve();
  if (active.has(owner)) return active.get(owner)!;
  const run = async () => {
    for (let i = 0; i < 1000; i++) {
      const token = readToken();
      if (!token || !stillOwner() || navigator.onLine === false) return;
      const key = keys(owner)[0]; if (!key) return;
      const stored = localStorage.getItem(key); if (!stored) continue;
      let next: ExtraResult;
      try { next = JSON.parse(stored); } catch { localStorage.removeItem(key); changed(); continue; }
      try {
        await api.extraPracticeResult(token, next);
      } catch (error) {
        // 400（这一轮验不过、格式不对）和 404（加练已关）重试也不会成功：丢掉这条，
        // 不让「还有 n 条没传好」永远挂着、每 15 秒白打一次。401/断网/5xx 留着下次补。
        if (error instanceof ApiError && (error.status === 400 || error.status === 404)) {
          if (!stillOwner() || readToken() !== token) return;
          localStorage.removeItem(key); changed(); continue;
        }
        // 旧令牌的请求迟到时，学生可能已经重新登录拿到新令牌：这时的 401 属于旧会话，
        // 不能拿去把新会话踢出去（2026-11-06 Codex 复审）。只停下这一轮，下次用新令牌补交。
        if (readToken() !== token) return;
        throw error;
      }
      // A late response after account switch cannot recreate old storage.
      if (!stillOwner() || readToken() !== token) return;
      localStorage.removeItem(key); changed();
    }
  };
  const promise = run().finally(() => active.delete(owner)); active.set(owner, promise); return promise;
}
