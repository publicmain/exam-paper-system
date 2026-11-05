import { useEffect } from 'react';
import { getState } from '../../lib/auth-store';
import { flushExtraResults } from './result-queue';
export function syncExtraFor(owner: string) {
  return flushExtraResults(owner, () => { const state = getState(); return state.status === 'authenticated' && state.profile.id === owner; });
}
/** Leaving the exercise must not strand results. */
export default function ExtraPracticeSync({ owner }: { owner: string }) {
  useEffect(() => {
    const flush = () => { void syncExtraFor(owner).catch(() => {}); };
    flush(); const timer = setInterval(flush, 15000);
    window.addEventListener('online', flush); window.addEventListener('extra-results-changed', flush);
    window.addEventListener('storage', flush);
    return () => { clearInterval(timer); window.removeEventListener('online', flush); window.removeEventListener('extra-results-changed', flush); window.removeEventListener('storage', flush); };
  }, [owner]);
  return null;
}
