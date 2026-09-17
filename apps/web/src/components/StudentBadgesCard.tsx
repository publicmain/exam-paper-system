import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

/**
 * 学生徽章（F05 / F06，2026-09-15）—— 老师查看、以「数据有误」撤销、恢复。
 *
 * 徽章只描述做过的事，不是能力评价。撤销只用于数据有误（例如重复导入的答卷），必须写理由；
 * 学生在自己的徽章页看得到理由；可以恢复；两种操作服务端都留审计。
 */

function errorText(e: any): string {
  const code = e?.body?.code ?? e?.body?.message?.code;
  if (code === 'not_your_class') return '这不是你任教的班。';
  if (code === 'student_not_in_class') return '这个学生不在这个班里。';
  if (code === 'badge_already_revoked') return '这枚徽章已经被撤销过了（可能另一位老师刚处理），已刷新。';
  if (code === 'badge_not_revoked') return '这枚徽章没有被撤销，已刷新。';
  if (code === 'badge_not_earned') return '这枚徽章还没有正式记录，不需要撤销。';
  if (code === 'revoke_reason_required') return '请写清楚撤销理由（至少 2 个字）。';
  if (code === 'module_off') return '徽章暂时关闭了。';
  return String(e?.message ?? '没加载出来，再试一次。');
}

export default function StudentBadgesCard({ classId, studentId }: { classId: string; studentId: string }) {
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const scope = useRef('');
  scope.current = `${classId}:${studentId}`;

  const reload = () => {
    const mine = scope.current;
    return api
      .teachingStudentBadges(classId, studentId)
      .then((r: any) => { if (scope.current === mine) setData(r); })
      .catch((e: any) => { if (scope.current === mine) setError(errorText(e)); });
  };

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    setRevoking(null);
    setBusy(false); setReason(''); sending.current = false;
    api
      .teachingStudentBadges(classId, studentId)
      .then((r: any) => alive && setData(r))
      .catch((e: any) => alive && setError(errorText(e)));
    return () => {
      alive = false;
    };
  }, [classId, studentId]);

  async function run(fn: () => Promise<any>) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const mine = scope.current;
    try {
      const result = await fn();
      if (scope.current !== mine) return;
      setData(result);
      setRevoking(null);
      setReason('');
    } catch (e: any) {
      if (scope.current !== mine) return;
      setError(errorText(e));
      if (e?.status === 409) void reload();
    } finally {
      if (scope.current === mine) { sending.current = false; setBusy(false); }
    }
  }

  const badges: any[] = data?.badges ?? [];
  const legacyBadges: any[] = data?.legacyBadges ?? [];
  const byKey = new Map([...badges, ...legacyBadges].map((badge) => [badge.key, badge]));
  const groups = [
    { key: 'current', title: '当前徽章', items: badges },
    { key: 'legacy', title: '旧版徽章 · 历史保留', items: legacyBadges },
  ].filter((group) => group.items.length > 0);
  return (
    <div className="border rounded-lg p-4 bg-white space-y-2" data-testid="student-badges-card">
      <h3 className="font-semibold">徽章</h3>
      {data?.rulesVersion === 5 && <p className="text-sm text-gray-700" data-testid="t-v5-summary">V5 收藏 · {badges.filter((b) => b.earned && b.saved && !b.revoked).length} / 16 枚已获得，每一级独立保存。</p>}
      <p className="text-xs text-gray-500">徽章只描述做过的事，不是能力评价。撤销只用于数据有误，必须写理由，学生看得到理由，可以恢复。</p>
      {error ? (
        <p data-testid="badges-error" className="text-sm bg-red-50 text-red-700 rounded px-3 py-2">
          {error}
        </p>
      ) : null}
      {!data && !error ? <p className="text-sm text-gray-500" role="status">正在读取学生收藏…</p> : null}
      {error && !data ? <button type="button" onClick={() => { setError(null); void reload(); }} className="min-h-[44px] text-sm text-blue-700">重新读取徽章</button> : null}
      {groups.map((group) => (
      <section key={group.key} data-testid={`t-badges-${group.key}`}>
        <h4 className="text-xs font-semibold text-gray-600 pt-2">{group.title}</h4>
        {group.key === 'legacy' ? <p className="text-xs text-gray-500">保留原获得日期与撤销记录，不换算为新版四级奖章。</p> : null}
        <ul className="divide-y">
        {group.items.map((b) => (
          <li key={b.key} data-testid={`t-badge-${b.key}`} className="py-2 text-sm space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{b.title}</span>
              <span className="text-gray-600 tabular-nums">
                {b.revoked
                  ? `已撤销：${b.revoked.reason ?? ''}`
                  : b.earned
                    ? data?.rulesVersion === 5
                      ? `${b.grantedAt ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(b.grantedAt)) : '已'} 收藏入库`
                      : `${b.earnedOn} 得到${b.saved ? '' : '（学生下次打开徽章页时记录）'}`
                    : b.hidden && b.threshold == null
                      ? '尚未发现'
                    : b.blockedBy?.length
                      ? '前序记录待核对'
                      : `进行中 ${b.current} / ${b.threshold} ${b.unit}`}
              </span>
            </div>
            {b.hidden && !b.earned && b.threshold == null ? <p className="text-xs text-gray-500">{b.clue ?? '隐藏珍藏，解锁后显示。'}</p> : data?.rulesVersion === 5 && b.description ? <p className="text-xs text-gray-500">{b.description}</p> : null}
            {b.blockedBy?.length ? (
              <p className="text-xs text-amber-800" data-testid={`t-badge-blocked-${b.key}`}>
                前序记录待核对：{b.blockedBy.map((key: string) => {
                  const dependency = byKey.get(key);
                  return `${dependency?.title ?? key}（${dependency?.revoked?.reason || '记录需核对'}）`;
                }).join('；')}。{b.earned && b.saved ? '本阶已保存奖章保留。' : '核对恢复前不授予此阶。'}
              </p>
            ) : null}
            {b.earned && b.saved && revoking !== b.key ? (
              <button type="button" data-testid={`t-revoke-${b.key}`} onClick={() => { setRevoking(b.key); setReason(''); }} className="text-xs text-red-700 hover:underline min-h-[32px]">
                撤销（数据有误）
              </button>
            ) : null}
            {b.revoked ? (
              <button type="button" data-testid={`t-restore-${b.key}`} disabled={busy} onClick={() => void run(() => api.teachingRestoreBadge(classId, studentId, b.key, null))} className="text-xs text-gray-800 hover:underline min-h-[32px] disabled:opacity-60">
                恢复这枚徽章
              </button>
            ) : null}
            {revoking === b.key ? (
              <div className="space-y-2 rounded bg-gray-50 p-2" data-testid={`t-revoke-form-${b.key}`}>
                <label className="block text-xs text-gray-600">
                  撤销理由（学生会看到）
                  <textarea
                    data-testid={`t-revoke-reason-${b.key}`}
                    value={reason}
                    maxLength={200}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1 block w-full border rounded px-2 py-1 text-sm"
                    rows={2}
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    data-testid={`t-revoke-confirm-${b.key}`}
                    disabled={busy || reason.trim().length < 2}
                    onClick={() => void run(() => api.teachingRevokeBadge(classId, studentId, b.key, reason.trim()))}
                    className="px-3 py-1.5 rounded bg-red-700 text-white text-xs disabled:opacity-50 min-h-[32px]"
                  >
                    {busy ? '处理中…' : '确认撤销'}
                  </button>
                  <button type="button" onClick={() => setRevoking(null)} className="px-3 py-1.5 rounded bg-gray-100 text-xs min-h-[32px]">
                    取消
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
        </ul>
      </section>
      ))}
    </div>
  );
}
