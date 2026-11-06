import { useEffect } from 'react';
import { getState, handleAuthFailure } from '../../lib/auth-store';
import { flushExtraResults } from './result-queue';
export function syncExtraFor(owner: string) {
  return flushExtraResults(owner, () => { const state = getState(); return state.status === 'authenticated' && state.profile.id === owner; });
}
/** Leaving the exercise must not strand results. */
export default function ExtraPracticeSync({ owner }: { owner: string }) {
  useEffect(() => {
    const stillOwner = () => { const state = getState(); return state.status === 'authenticated' && state.profile.id === owner; };
    // 登录失效（401）走统一的退回登录页；待传结果留着，重新登录后再补。
    let alive = true;
    const flush = () => { void syncExtraFor(owner).catch((e) => { if (alive && stillOwner()) handleAuthFailure(e); }); };
    // 只认加练队列自己的键：别的键（尤其 readToken 的存储探测键）一变就 flush，
    // 两个标签页会互相触发、无限空转（2026-11-06 Codex 审查）。
    const onStorage = (e: StorageEvent) => { if (e.key === null || e.key.startsWith('sw:extra:')) flush(); };
    flush(); const timer = setInterval(flush, 15000);
    window.addEventListener('online', flush); window.addEventListener('extra-results-changed', flush);
    window.addEventListener('storage', onStorage);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('online', flush); window.removeEventListener('extra-results-changed', flush); window.removeEventListener('storage', onStorage); };
  }, [owner]);
  return null;
}
