import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, type AchievementBadge, type AchievementClassmates, type AchievementsList, type ClassmateMedal } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';
import { BackButton, Page } from '../design/Page';
import { Button } from '../design/Button';
import { Dialog } from '../design/Dialog';
import { StatusView } from '../design/Status';
import { markAchievementViewed, syncAchievementNotices } from '../lib/achievement-notices';
import { MedalImage, MedalViewer } from '../components/MedalViewer';

type Load<T> = { s: 'loading' } | { s: 'error' } | { s: 'off' } | { s: 'ready'; data: T };
type Selection = { kind: 'mine'; key: string } | { kind: 'peer'; student: string; badge: ClassmateMedal };
const seriesNames: Record<string, string> = { reading: '阅读探索者', vocabulary: '词汇积累者', mastery: '词汇挑战者', hidden: '隐藏珍藏', legendary: '终极典藏' };
const owned = (badge: AchievementBadge) => badge.earned && badge.saved && !badge.revoked;
const secret = (badge: AchievementBadge) => Boolean((badge.hidden || badge.series === 'hidden') && !owned(badge));
const progress = (badge: AchievementBadge) => Math.max(0, Math.min(badge.threshold ?? 0, Number.isFinite(badge.current) ? badge.current ?? 0 : 0));
const dateText = (date: string | null | undefined) => {
  if (!date) return null;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Singapore', year: 'numeric', month: 'long', day: 'numeric' }).format(parsed);
};

function HiddenSilhouette() {
  return <div className="relative grid aspect-square w-full place-items-center" data-testid="hidden-silhouette" aria-hidden="true"><svg viewBox="0 0 120 120" className="h-3/4 w-3/4 text-ink-3"><path d="M60 10 98 30v44L60 110 22 74V30Z" fill="currentColor" opacity=".14" /><path d="M60 21 88 36v33l-28 28-28-28V36Z" fill="none" stroke="currentColor" opacity=".25" strokeWidth="1.5" /></svg><span className="absolute text-title1 text-ink-3">?</span></div>;
}

export default function BadgesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'mine' | 'class'>('mine');
  const [load, setLoad] = useState<Load<AchievementsList>>({ s: 'loading' });
  const [classLoad, setClassLoad] = useState<Load<AchievementClassmates>>({ s: 'loading' });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [replay, setReplay] = useState(0);
  const [replaying, setReplaying] = useState(false);
  const gen = useRef(0), classGen = useRef(0);
  const fetchAll = useCallback(async () => {
    const token = readToken(); if (!token) return;
    const mine = ++gen.current; setLoad({ s: 'loading' });
    try {
      let data = await api.achievements(token);
      if (mine !== gen.current || readToken() !== token) return;
      if (!data || !Array.isArray(data.badges) || data.rulesVersion !== 5) throw new Error('V5 achievements unavailable');
      if (data.unsaved?.length) {
        await syncAchievementNotices();
        if (mine !== gen.current || readToken() !== token) return;
        // Initial backfill can finish while this page is already open. Read the
        // saved result once; do not leave newly granted medals gray until reload.
        data = await api.achievements(token);
        if (mine !== gen.current || readToken() !== token) return;
        if (!data || !Array.isArray(data.badges) || data.rulesVersion !== 5) throw new Error('V5 achievements unavailable');
      }
      setLoad({ s: 'ready', data });
    } catch (error) {
      if (mine !== gen.current || readToken() !== token || handleAuthFailure(error)) return;
      setLoad({ s: error instanceof ApiError && error.body?.code === 'module_off' ? 'off' : 'error' });
    }
  }, []);
  const fetchClass = useCallback(async () => {
    const token = readToken(); if (!token) return;
    const mine = ++classGen.current; setClassLoad({ s: 'loading' });
    try {
      const data = await api.achievementClassmates(token);
      if (mine !== classGen.current || readToken() !== token) return;
      if (!data || !Array.isArray(data.classes)) throw new Error('Invalid classmates response');
      setClassLoad({ s: 'ready', data });
    } catch (error) {
      if (mine !== classGen.current || readToken() !== token || handleAuthFailure(error)) return;
      setClassLoad({ s: error instanceof ApiError && error.body?.code === 'module_off' ? 'off' : 'error' });
    }
  }, []);
  useEffect(() => { void fetchAll(); return () => { gen.current++; classGen.current++; }; }, [fetchAll]);
  useEffect(() => { if (tab === 'class') void fetchClass(); }, [tab, fetchClass]);
  const badges = load.s === 'ready' ? load.data.badges.filter((badge) => badge.key.startsWith('v5_')) : [];
  const detail = selection?.kind === 'mine' ? badges.find((badge) => badge.key === selection.key) : null;
  const concealed = detail ? secret(detail) : false;
  const title = selection?.kind === 'peer' ? selection.badge.title : concealed ? '尚未发现的珍藏' : detail?.title ?? '徽章详情';
  const asset = selection?.kind === 'peer' ? selection.badge.assetId : concealed ? null : detail?.assetId;
  const close = () => { setSelection(null); setReplaying(false); };
  const inspect = (badge: AchievementBadge) => {
    setReplaying(false); setReplay(0); setSelection({ kind: 'mine', key: badge.key });
    if (owned(badge) && badge.isNew) {
      const token = readToken();
      void markAchievementViewed([badge.key]).then((ok) => {
        if (!ok || readToken() !== token) return;
        setLoad((state) => state.s === 'ready' ? { ...state, data: { ...state.data, badges: state.data.badges.map((row) => row.key === badge.key ? { ...row, isNew: false } : row) } } : state);
      });
    }
  };

  return <Page title="我的徽章" subtitle="让每一段努力，都有值得收藏的纪念。" width="wide" leading={<BackButton label="今日" onClick={() => navigate(ROUTES.today)} />} testId="badges-page">
    <div role="tablist" aria-label="徽章收藏" className="mb-5 grid grid-cols-2 rounded-control bg-fill p-1">
      {([['mine', '我的徽章'], ['class', '班级收藏']] as const).map(([id, text]) => <button key={id} id={`badges-tab-${id}`} type="button" role="tab" tabIndex={tab === id ? 0 : -1} aria-selected={tab === id} aria-controls={`badges-panel-${id}`} onClick={() => { close(); setTab(id); }} onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); const next = event.key === 'Home' ? 'mine' : event.key === 'End' ? 'class' : id === 'mine' ? 'class' : 'mine';
        close(); setTab(next); document.getElementById(`badges-tab-${next}`)?.focus();
      }} className={`min-h-[44px] rounded-control px-4 text-callout ${tab === id ? 'bg-surface font-semibold text-ink shadow-sm' : 'text-ink-2'}`}>{text}</button>)}
    </div>
    {tab === 'mine' ? <section role="tabpanel" id="badges-panel-mine" aria-labelledby="badges-tab-mine">
      {load.s === 'loading' ? <StatusView kind="loading" title="正在打开收藏" testId="badges-loading" /> : load.s === 'error' ? <StatusView kind="error" title="徽章暂时没加载出来" message="你的学习记录都还在。连上网络后再试一下。" onRetry={() => void fetchAll()} testId="badges-error" /> : load.s === 'off' ? <StatusView kind="empty" title="徽章暂未开放" message="不影响每天的学习任务。" testId="badges-off" /> : <>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-group bg-surface p-4" data-testid="medal-overview"><div><p className="text-title2 text-ink">{badges.filter(owned).length} <span className="text-callout text-ink-3">/ 16 枚已收藏</span></p><p className="mt-1 text-footnote text-ink-3">每一级独立收藏，不增加学习任务。</p></div><Button size="sm" variant="plain" onClick={() => void fetchAll()}>刷新进度</Button></div>
        <div data-testid="medal-collection">{Object.entries(seriesNames).map(([series, label]) => <section key={series} className="mb-6" aria-label={label}><h2 className="mb-3 text-headline text-ink">{label}</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{badges.filter((badge) => badge.series === series).map((badge) => {
          const earned = owned(badge), hidden = secret(badge);
          return <button key={badge.key} type="button" data-testid={`medal-card-${badge.key}`} onClick={() => inspect(badge)} aria-label={`${hidden ? '尚未发现的珍藏' : badge.title}，${earned ? '已获得' : '尚未获得'}`} className="relative min-w-0 rounded-group border border-line bg-surface p-3 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:p-4">
            {hidden || !badge.assetId ? <HiddenSilhouette /> : <MedalImage assetId={badge.assetId} locked={!earned} thumbnail className={`aspect-square w-full object-contain ${earned ? '' : 'grayscale opacity-45'}`} />}
            {earned && badge.isNew && <span className="absolute right-3 top-3 rounded-full bg-accent-fill px-2 py-1 text-caption text-accent-on" aria-label="新获得，尚未查看">NEW</span>}
            <p className="text-callout font-semibold text-ink">{hidden ? '隐藏珍藏' : badge.title}</p>
            <p className="mt-1 text-caption text-ink-3">{hidden ? badge.clue ?? '继续学习，惊喜会在途中出现。' : earned ? '已收藏' : badge.revoked ? '记录待核对' : badge.blockedBy?.length ? '前序记录待核对' : `${progress(badge)} / ${badge.threshold ?? '—'} ${badge.unit}`}</p>
          </button>;
        })}</div></section>)}</div>
        <p className="rounded-group bg-surface p-4 text-footnote leading-relaxed text-ink-2">进度仅自己和授权老师可见。补做可以累计，不要求连续学习；不会因为中断而失去已获得的徽章。自主练习不计入，也不额外安排复习任务。</p>
      </>}
    </section> : <section role="tabpanel" id="badges-panel-class" aria-labelledby="badges-tab-class">
      <p className="mb-4 text-footnote text-ink-3">按姓名排列，只分享已经获得的徽章。这里不是排行榜，不展示成绩或学习进度。</p>
      {classLoad.s === 'loading' ? <StatusView kind="loading" title="正在打开班级收藏" /> : classLoad.s === 'error' ? <StatusView kind="error" title="班级收藏暂时没加载出来" onRetry={() => void fetchClass()} /> : classLoad.s === 'off' ? <StatusView kind="empty" title="班级收藏暂未开放" /> : !classLoad.data.classes.length ? <StatusView kind="empty" title="暂时没有可查看的班级" message="加入班级后，可以欣赏同班同学的收藏。" /> : classLoad.data.classes.map((group) => <section key={group.id} className="mb-6"><h2 className="mb-3 text-headline text-ink">{group.name}</h2><ul className="divide-y divide-line rounded-group bg-surface">{[...group.students].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN') || a.id.localeCompare(b.id)).map((student) => <li key={student.id} className="p-4" data-testid={`classmate-${student.id}`}><h3 className="text-callout font-semibold text-ink">{student.name}</h3>{student.badges.length ? <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">{student.badges.filter((badge) => badge.key.startsWith('v5_')).map((badge) => <button key={badge.key} type="button" className="min-w-0 rounded-control p-1 text-center focus-visible:outline focus-visible:outline-accent" onClick={() => { setReplaying(false); setSelection({ kind: 'peer', student: student.name, badge }); }} aria-label={`查看${student.name}的${badge.title}`}><MedalImage assetId={badge.assetId} thumbnail className="aspect-square w-full object-contain" /><span className="text-caption text-ink-2">{badge.title}</span></button>)}</div> : <p className="mt-2 text-footnote text-ink-3">正在开启自己的收藏。</p>}</li>)}</ul></section>)}
    </section>}
    <Dialog open={Boolean(selection)} onClose={close} title={title} description={selection?.kind === 'peer' ? `${selection.student}已获得的收藏` : concealed ? '留一点未知，给未来的惊喜。' : detail && owned(detail) ? '这是属于你的学习纪念。' : '尚未解锁 · 灰色模型预览'} placement="sheet" size="lg" initialFocus="panel" testId="medal-detail" footer={<Button block variant="neutral" onClick={close}>返回收藏</Button>}>
      {concealed ? <><HiddenSilhouette /><p className="mb-4 text-center text-callout text-ink-2" data-testid="hidden-clue">{detail?.clue ?? '继续学习，惊喜会在途中出现。'}</p></> : <>
        {asset && <MedalViewer key={`${asset}:${replay}`} assetId={asset} locked={selection?.kind === 'mine' && Boolean(detail && !owned(detail))} title={title} reveal={replaying} />}
        {selection?.kind === 'mine' && detail && <div className="mt-4" data-testid="medal-detail-rule"><h3 className="text-headline text-ink">获得条件</h3><p className="mt-1 text-footnote leading-relaxed text-ink-2">{detail.description}</p>
          {detail.threshold != null && <><p className="mt-3 text-callout text-ink" data-testid="private-progress">{progress(detail)} / {detail.threshold} {detail.unit}</p><div role="progressbar" aria-label={`${title}进度`} aria-valuemin={0} aria-valuemax={detail.threshold} aria-valuenow={progress(detail)} className="mt-2 h-2 overflow-hidden rounded-full bg-fill"><div className="h-full rounded-full bg-accent-fill" style={{ width: `${detail.threshold > 0 ? progress(detail) / detail.threshold * 100 : 0}%` }} /></div></>}
          {owned(detail) && <><p className="mt-3 text-footnote text-ink-3">{dateText(detail.grantedAt ?? detail.createdAt) ? `${dateText(detail.grantedAt ?? detail.createdAt)} · 收藏入库` : '已安全保存到你的收藏'}</p><Button className="mt-4" variant="secondary" onClick={() => { setReplay((count) => count + 1); setReplaying(true); }}>重播获得动画</Button></>}
          {detail.revoked && <p className="mt-3 text-footnote text-ink-2">老师正在核对记录：{detail.revoked.reason ?? '记录需要核对'}。</p>}
          {Boolean(detail.blockedBy?.length) && <p className="mt-3 text-footnote text-ink-2">相关前序记录待老师核对。学习数量仍保留，无需反复补做。</p>}
        </div>}
      </>}
    </Dialog>
  </Page>;
}
